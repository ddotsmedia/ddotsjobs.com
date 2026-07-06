import { Resend } from 'resend';
import { and, db, desc, eq, gt, gte, inArray, isNull, sql, tables } from '@ddotsjobs/db';
import { queues } from '../queues.js';
import { logger } from '../lib/logger.js';

const DAILY_JOB = 'alert_digest_daily';
const WEEKLY_JOB = 'alert_digest_weekly';
const GREEN_BASE_URL = process.env.GREEN_API_BASE_URL ?? 'https://api.green-api.com';

/** Register daily + weekly digest crons (09:00 UTC+4 = 05:00 UTC). */
export async function registerAlertDigestCrons(): Promise<void> {
  await queues.maintenance.add(
    DAILY_JOB,
    {},
    { repeat: { pattern: '0 5 * * *' }, jobId: 'alert-digest-daily-cron', removeOnComplete: true },
  );
  await queues.maintenance.add(
    WEEKLY_JOB,
    {},
    { repeat: { pattern: '0 5 * * 1' }, jobId: 'alert-digest-weekly-cron', removeOnComplete: true },
  );
}

/** True only if an admin has explicitly enabled digests. Defaults OFF. */
async function digestsActive(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: tables.siteSettings.value })
      .from(tables.siteSettings)
      .where(eq(tables.siteSettings.key, 'alert_digests_active'))
      .limit(1);
    return (row?.value ?? 'false') === 'true';
  } catch {
    return false;
  }
}

type FilterRow = { filterType: string | null; filterValue: string | null };

interface DigestJob {
  id: string;
  slug: string | null;
  title: string;
  company: string;
  district: string | null;
  salaryMinPaise: number | null;
}

// Live jobs matching a subscription's filters, newer than `since`, not yet
// dispatched to this user. Mirrors the immediate matcher's filter semantics.
async function matchDigestJobs(userId: string, filters: FilterRow[], since: Date): Promise<DigestJob[]> {
  const vals = (t: string) => filters.filter((f) => f.filterType === t && f.filterValue).map((f) => f.filterValue!);
  const cats = vals('category');
  const dists = vals('district');
  const types = vals('job_type');
  const salaryMin = filters.find((f) => f.filterType === 'salary_min_paise' && f.filterValue)?.filterValue;
  const wantsWalkIn = filters.some((f) => f.filterType === 'is_walk_in');
  const wantsGulf = filters.some((f) => f.filterType === 'values_gulf_experience');

  const j = tables.jobs;
  const conds = [eq(j.status, 'active'), isNull(j.deletedAt), gt(j.publishedAt, since)];
  if (cats.length) conds.push(inArray(j.categorySlug, cats));
  if (dists.length) conds.push(inArray(j.district, dists as (typeof j.district.enumValues)[number][]));
  if (types.length) conds.push(inArray(j.type, types as (typeof j.type.enumValues)[number][]));
  if (salaryMin != null) conds.push(gte(j.salaryMinPaise, Number(salaryMin)));
  if (wantsWalkIn) conds.push(eq(j.isWalkIn, true));
  if (wantsGulf) conds.push(eq(j.valuesGulfExperience, true));
  conds.push(
    sql`NOT EXISTS (SELECT 1 FROM alert_dispatch_log dl WHERE dl.job_id = ${j.id} AND dl.user_id = ${userId})`,
  );

  const rows = await db
    .select({
      id: j.id,
      slug: j.slug,
      title: j.titleEn,
      district: j.district,
      salaryMinPaise: j.salaryMinPaise,
      displayNameEn: tables.employers.displayNameEn,
      legalNameEn: tables.employers.legalNameEn,
    })
    .from(j)
    .innerJoin(tables.employers, eq(j.employerId, tables.employers.id))
    .where(and(...conds))
    .orderBy(desc(j.publishedAt))
    .limit(10);

  return rows.map(({ displayNameEn, legalNameEn, ...r }) => ({
    ...r,
    company: displayNameEn ?? legalNameEn ?? 'An employer',
  }));
}

function titleCase(s: string | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function jobLine(job: DigestJob): string {
  const salary = job.salaryMinPaise != null ? ` · ₹${Math.round(job.salaryMinPaise / 100).toLocaleString('en-IN')}/mo` : '';
  return `${job.title} — ${job.company}${job.district ? ` · ${titleCase(job.district)}` : ''}${salary}`;
}

async function sendEmailDigest(to: string, label: string, jobs: DigestJob[]): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  const items = jobs
    .map(
      (job) =>
        `<li style="margin-bottom:8px"><a href="https://ddotsjobs.com/jobs/${job.slug ?? job.id}">${job.title}</a>` +
        ` — ${job.company}${job.district ? ` · ${titleCase(job.district)}` : ''}` +
        `${job.salaryMinPaise != null ? ` · ₹${Math.round(job.salaryMinPaise / 100).toLocaleString('en-IN')}/mo` : ''}</li>`,
    )
    .join('');
  const html =
    `<h2>🔔 ${jobs.length} new job${jobs.length === 1 ? '' : 's'} matching "${label}"</h2>` +
    `<ul style="padding-left:18px">${items}</ul>` +
    `<hr/><p style="font-size:12px;color:#888">Manage or unsubscribe in your ` +
    `<a href="https://ddotsjobs.com/seeker/alerts">ddotsjobs alert settings</a>.</p>`;
  await new Resend(key).emails.send({
    from: process.env.OTP_FROM ?? 'ddotsjobs <noreply@ddotsjobs.com>',
    to,
    subject: `🔔 ${jobs.length} new job${jobs.length === 1 ? '' : 's'} matching "${label}"`,
    html,
  });
}

async function sendWhatsAppDigest(phone: string, label: string, jobs: DigestJob[]): Promise<void> {
  const id = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  if (!id || !token) throw new Error('Green API credentials not set');
  const lines = jobs.map((job) => `• ${jobLine(job)}\n  👉 ddotsjobs.com/jobs/${job.slug ?? job.id}`).join('\n\n');
  const message = `🔔 *${jobs.length} new job${jobs.length === 1 ? '' : 's'} for "${label}"*\n\n${lines}\n\nReply STOP to unsubscribe`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${GREEN_BASE_URL}/waInstance${id}/sendMessage/${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: `${phone.replace('+', '')}@c.us`, message }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Green API ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Process daily_digest or weekly subscriptions and send one aggregated message each. */
export async function runAlertDigest(freq: 'daily_digest' | 'weekly'): Promise<{ processed: number; sent: number }> {
  if (!(await digestsActive())) {
    logger.info('[alert-digest] disabled by alert_digests_active setting — skipping');
    return { processed: 0, sent: 0 };
  }
  const windowMs = freq === 'weekly' ? 7 * 864e5 : 864e5;
  const s = tables.alertSubscriptions;
  const subs = await db
    .select({
      id: s.id,
      userId: s.seekerUserId,
      channel: s.channel,
      labelEn: s.labelEn,
      lastSentAt: s.lastSentAt,
      phone: tables.users.phone,
      email: tables.users.email,
    })
    .from(s)
    .innerJoin(tables.users, eq(tables.users.id, s.seekerUserId))
    .where(and(eq(s.frequencyCode, freq), eq(s.isActive, true), isNull(s.deletedAt), isNull(tables.users.deletedAt)));

  let sent = 0;
  for (const sub of subs) {
    try {
      const filters: FilterRow[] = await db
        .select({ filterType: tables.alertFilters.filterType, filterValue: tables.alertFilters.filterValue })
        .from(tables.alertFilters)
        .where(eq(tables.alertFilters.subscriptionId, sub.id));

      const since = sub.lastSentAt ?? new Date(Date.now() - windowMs);
      const jobs = await matchDigestJobs(sub.userId, filters, since);
      if (jobs.length === 0) continue;

      const label = sub.labelEn ?? 'your job alert';
      if (sub.channel === 'email') {
        if (!sub.email) continue;
        await sendEmailDigest(sub.email, label, jobs);
      } else {
        if (!sub.phone) continue;
        await sendWhatsAppDigest(sub.phone, label, jobs);
      }

      // Log each job so it is never re-sent to this user (idempotency).
      await db
        .insert(tables.alertDispatchLog)
        .values(
          jobs.map((job) => ({
            jobId: job.id,
            userId: sub.userId,
            subscriptionId: sub.id,
            channel: sub.channel,
            deliveryStatus: 'sent' as const,
          })),
        )
        .onConflictDoNothing({ target: [tables.alertDispatchLog.jobId, tables.alertDispatchLog.userId] });

      await db
        .update(s)
        .set({ lastSentAt: new Date(), totalSent: sql`${s.totalSent} + ${jobs.length}` })
        .where(eq(s.id, sub.id));
      sent++;
    } catch (err) {
      logger.error({ err, subId: sub.id }, '[alert-digest] subscription failed');
    }
  }

  logger.info({ freq, processed: subs.length, sent }, '[alert-digest] run complete');
  return { processed: subs.length, sent };
}
