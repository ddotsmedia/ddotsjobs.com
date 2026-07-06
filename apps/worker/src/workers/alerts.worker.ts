import type { Job } from 'bullmq';
import { and, db, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { queues } from '../queues.js';

export interface MatchJob {
  jobId: string;
}

interface MatchRow {
  sub_id: string;
  user_id: string;
  channel: string;
  language: string;
  phone: string;
  email: string | null;
}

/** ddotsjobs:alerts processor — match a freshly active job to subscriptions. */
export async function alertsQueueProcessor(job: Job): Promise<unknown> {
  if (job.name === 'match_job_alerts') return matchJobAlerts(job.data as MatchJob);
  console.warn(`[alerts] unhandled job ${job.name}`);
  return { skipped: true };
}

// Admin kill-switch: skip alert delivery entirely if disabled in site_settings.
async function whatsappAlertsActive(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: tables.siteSettings.value })
      .from(tables.siteSettings)
      .where(eq(tables.siteSettings.key, 'whatsapp_alerts_active'))
      .limit(1);
    return (row?.value ?? 'true') === 'true';
  } catch {
    return true;
  }
}

export async function matchJobAlerts(data: MatchJob): Promise<{ recipients: number }> {
  if (!(await whatsappAlertsActive())) {
    console.log('[alerts] WhatsApp alerts disabled by admin setting — skipping');
    return { recipients: 0 };
  }
  const j = tables.jobs;
  const [jobRow] = await db
    .select({
      category: j.categorySlug,
      district: j.district,
      type: j.type,
      salaryMinPaise: j.salaryMinPaise,
      isWalkIn: j.isWalkIn,
      valuesGulfExperience: j.valuesGulfExperience,
      titleEn: j.titleEn,
      employerId: j.employerId,
    })
    .from(j)
    .where(eq(j.id, data.jobId))
    .limit(1);
  if (!jobRow || !jobRow.category || !jobRow.district) return { recipients: 0 };

  const [employer] = await db
    .select({ displayNameEn: tables.employers.displayNameEn, legalNameEn: tables.employers.legalNameEn })
    .from(tables.employers)
    .where(eq(tables.employers.id, jobRow.employerId))
    .limit(1);
  const companyName = employer?.displayNameEn ?? employer?.legalNameEn ?? 'An employer';

  // Find subscriptions whose category + district filters both match.
  const matched = await db.execute(sql`
    SELECT DISTINCT sub.id AS sub_id, sub.seeker_user_id AS user_id,
           sub.channel::text AS channel, sub.language AS language, u.phone AS phone, u.email AS email
    FROM alert_subscriptions sub
    JOIN users u ON u.id = sub.seeker_user_id
    JOIN alert_filters f_cat ON f_cat.subscription_id = sub.id
      AND f_cat.filter_type = 'category' AND f_cat.filter_value = ${jobRow.category}
    JOIN alert_filters f_dist ON f_dist.subscription_id = sub.id
      AND f_dist.filter_type = 'district' AND f_dist.filter_value = ${jobRow.district}
    WHERE sub.is_active = true AND sub.deleted_at IS NULL AND u.deleted_at IS NULL
      -- Instant alerts only; daily_digest/weekly subs are handled by the digest cron.
      AND sub.frequency_code = 'immediate'
      -- Optional refinements: apply a filter only if the sub declares that type.
      AND (
        NOT EXISTS (SELECT 1 FROM alert_filters f WHERE f.subscription_id = sub.id AND f.filter_type = 'job_type')
        OR EXISTS (SELECT 1 FROM alert_filters f WHERE f.subscription_id = sub.id AND f.filter_type = 'job_type' AND f.filter_value = ${jobRow.type})
      )
      AND (
        NOT EXISTS (SELECT 1 FROM alert_filters f WHERE f.subscription_id = sub.id AND f.filter_type = 'salary_min_paise')
        OR EXISTS (SELECT 1 FROM alert_filters f WHERE f.subscription_id = sub.id AND f.filter_type = 'salary_min_paise' AND CAST(f.filter_value AS BIGINT) <= ${jobRow.salaryMinPaise})
      )
      AND (
        NOT EXISTS (SELECT 1 FROM alert_filters f WHERE f.subscription_id = sub.id AND f.filter_type = 'is_walk_in')
        OR ${jobRow.isWalkIn}
      )
      AND (
        NOT EXISTS (SELECT 1 FROM alert_filters f WHERE f.subscription_id = sub.id AND f.filter_type = 'values_gulf_experience')
        OR ${jobRow.valuesGulfExperience}
      )
      AND NOT EXISTS (
        SELECT 1 FROM alert_dispatch_log dl
        WHERE dl.job_id = ${data.jobId} AND dl.user_id = sub.seeker_user_id
      )
    LIMIT 500
  `);
  const rows = matched.rows as unknown as MatchRow[];
  if (rows.length === 0) return { recipients: 0 };

  // Score against fit_scores cache (default 50), keep top 15.
  const userIds = rows.map((r) => r.user_id);
  const fitRows = await db
    .select({ userId: tables.fitScores.seekerUserId, score: tables.fitScores.score })
    .from(tables.fitScores)
    .where(and(eq(tables.fitScores.jobId, data.jobId), isNull(tables.fitScores.deletedAt)));
  const scoreByUser = new Map(fitRows.filter((f) => userIds.includes(f.userId)).map((f) => [f.userId, f.score]));

  const top = rows
    .map((r) => ({ r, score: scoreByUser.get(r.user_id) ?? 50 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  let dispatched = 0;
  for (const { r } of top) {
    const [logRow] = await db
      .insert(tables.alertDispatchLog)
      .values({
        jobId: data.jobId,
        userId: r.user_id,
        subscriptionId: r.sub_id,
        channel: r.channel as 'whatsapp' | 'email' | 'push' | 'sms',
        deliveryStatus: 'queued',
      })
      .onConflictDoNothing({ target: [tables.alertDispatchLog.jobId, tables.alertDispatchLog.userId] })
      .returning({ id: tables.alertDispatchLog.id });
    if (!logRow) continue; // already dispatched

    await queues.dispatch.add(
      r.channel === 'email' ? 'email_job' : 'whatsapp_job',
      {
        dispatchLogId: logRow.id,
        subscriptionId: r.sub_id,
        userId: r.user_id,
        phone: r.phone,
        email: r.email,
        channel: r.channel,
        language: r.language,
        jobId: data.jobId,
        jobTitle: jobRow.titleEn,
        companyName,
        district: jobRow.district,
        salaryMinPaise: jobRow.salaryMinPaise,
        isWalkIn: jobRow.isWalkIn,
      },
      { attempts: 5, backoff: { type: 'exponential', delay: 10_000 } },
    );
    dispatched++;
  }

  await db.update(j).set({ alertRecipientsCount: dispatched }).where(eq(j.id, data.jobId));
  console.log(`[alerts] job ${data.jobId} matched ${rows.length}, dispatched ${dispatched}`);
  return { recipients: dispatched };
}
