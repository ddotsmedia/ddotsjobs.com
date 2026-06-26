import { createHash } from 'node:crypto';
import axios from 'axios';
import type { Job } from 'bullmq';
import { callAI } from '@ddotsjobs/ai';
import { pscExtractNotificationPrompt, pscGenerateSummaryMlPrompt } from '@ddotsjobs/ai/prompts';
import { and, db, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';
import { queues, QUEUE_NAMES } from '../queues.js';

const PSC_URL = 'https://www.keralapsc.gov.in/notifications';
const LAST_HASH_KEY = 'psc:last_hash'; // -> ddotsjobs:psc:last_hash
const CRON_JOB_ID = 'psc-scrape-cron';
const PSC_JOB_NAME = 'psc.scrape';

/** Register the every-4-hours repeatable scrape on the ai queue. */
export async function registerPscCron(): Promise<void> {
  await queues.ai.add(
    PSC_JOB_NAME,
    {},
    { repeat: { pattern: '0 */4 * * *' }, jobId: CRON_JOB_ID, removeOnComplete: true },
  );
}

/** ai-queue processor — routes by job.name. */
export async function aiQueueProcessor(job: Job): Promise<unknown> {
  if (job.name === PSC_JOB_NAME) return runPscScrape();
  console.warn(`[ai] unhandled job ${job.name}`);
  return { skipped: true };
}

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60_000);
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function enqueuePscAlerts(categoryNo: string, event: string): Promise<void> {
  const subs = await db
    .select({ userId: tables.pscSubscriptions.userId })
    .from(tables.pscSubscriptions)
    .where(
      and(
        eq(tables.pscSubscriptions.subscriptionType, 'category'),
        eq(tables.pscSubscriptions.subscriptionValue, categoryNo),
        eq(tables.pscSubscriptions.isActive, true),
        isNull(tables.pscSubscriptions.deletedAt),
        sql`${tables.pscSubscriptions.alertFor} @> ${JSON.stringify([event])}::jsonb`,
      ),
    );

  for (const sub of subs) {
    await queues.dispatch.add('psc_alert', {
      kind: 'psc_alert',
      userId: sub.userId,
      categoryNo,
      event,
    });
  }
}

export async function runPscScrape(): Promise<{ status: string; processed?: number }> {
  // 1. fetch
  const res = await axios.get<string>(PSC_URL, {
    timeout: 15_000,
    headers: { 'User-Agent': 'ddotsjobs-bot' },
    responseType: 'text',
    transformResponse: (d: string) => d,
  });
  const html = String(res.data);

  // 2. unchanged?
  const hash = createHash('sha256').update(html).digest('hex');
  const last = await redis.get(LAST_HASH_KEY);
  if (last === hash) {
    console.log('PSC unchanged, skip');
    return { status: 'unchanged' };
  }

  // 3. store new hash
  await redis.set(LAST_HASH_KEY, hash, 'EX', 86_400);

  // 4. extract
  const spec = pscExtractNotificationPrompt({ html: cleanHtml(html) });
  const { data } = await callAI({
    task: spec.task,
    prompt: spec.prompt,
    system: spec.system,
    schema: spec.schema,
    maxTokens: 4096,
  });

  let processed = 0;
  for (const n of data.notifications) {
    const t = tables.pscNotifications;
    const [existing] = await db
      .select({ id: t.id, status: t.status })
      .from(t)
      .where(eq(t.categoryNumber, n.categoryNo))
      .limit(1);

    if (existing) {
      // 5. update status/exam on status change
      if (existing.status !== n.status) {
        await db
          .update(t)
          .set({ status: n.status, examDate: parseDate(n.examDate), updatedAt: new Date() })
          .where(eq(t.id, existing.id));
        // 7. notify subscribers of the change
        await enqueuePscAlerts(n.categoryNo, 'exam_date');
      } else if (n.examDate) {
        await db.update(t).set({ examDate: parseDate(n.examDate) }).where(eq(t.id, existing.id));
      }
    } else {
      // 5. insert new
      const [ins] = await db
        .insert(t)
        .values({
          categoryNumber: n.categoryNo,
          titleEn: n.postName,
          departmentEn: n.department,
          vacancies: n.totalVacancies,
          qualificationEn: n.qualificationText,
          scaleOfPay: n.scaleOfPay,
          lastDateToApply: parseDate(n.applicationEnd),
          examDate: parseDate(n.examDate),
          status: n.status,
          sourceUrl: n.sourceUrl ?? PSC_URL,
        })
        .returning({ id: t.id });

      // 6. Malayalam post name for new rows
      if (ins) {
        try {
          const mlSpec = pscGenerateSummaryMlPrompt({
            postName: n.postName,
            department: n.department,
          });
          const ml = await callAI({
            task: mlSpec.task,
            prompt: mlSpec.prompt,
            system: mlSpec.system,
            schema: mlSpec.schema,
          });
          await db.update(t).set({ titleMl: ml.data.postNameMl }).where(eq(t.id, ins.id));
        } catch (err) {
          console.error(`[psc] ML summary failed for ${n.categoryNo}: ${String(err)}`);
        }
      }
      // 7. notify subscribers of the new notification
      await enqueuePscAlerts(n.categoryNo, 'new_notification');
    }
    processed++;
  }

  console.log(`PSC scrape complete — ${processed} notifications`);
  return { status: 'processed', processed };
}

export { QUEUE_NAMES };
