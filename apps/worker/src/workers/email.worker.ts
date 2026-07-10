import { Resend } from 'resend';
import type { Job, Processor } from 'bullmq';
import { and, db, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';
import { logger } from '../lib/logger.js';
import { queues, type JobPayloads } from '../queues.js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ddotsjobs.com';
const FROM = process.env.OTP_FROM ?? 'ddotsjobs <noreply@ddotsjobs.com>';

type EventType = JobPayloads['email']['eventType'];

type PrefColumn = 'notifyOnMessages' | 'notifyOnEndorsements' | 'notifyOnExpiry' | 'notifyOnApplications';

// Which preference flag gates each event, and the per-user rate-limit window.
const CONFIG: Record<EventType, { prefColumn: PrefColumn; windowSec: number }> = {
  chat_message: { prefColumn: 'notifyOnMessages', windowSec: 300 }, // 1 / 5 min
  endorsement: { prefColumn: 'notifyOnEndorsements', windowSec: 86_400 }, // 1 / day
  job_expiry: { prefColumn: 'notifyOnExpiry', windowSec: 86_400 }, // 1 / day / job
  application: { prefColumn: 'notifyOnApplications', windowSec: 0 }, // per event
};

/** True only if an admin has explicitly enabled email notifications. Default OFF. */
async function emailsActive(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: tables.siteSettings.value })
      .from(tables.siteSettings)
      .where(eq(tables.siteSettings.key, 'email_notifications_active'))
      .limit(1);
    return (row?.value ?? 'false') === 'true';
  } catch {
    return false;
  }
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Branded HTML shell with a CTA button + one-click unsubscribe footer.
function shell(heading: string, bodyHtml: string, cta: { label: string; url: string }, unsubscribeUrl: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1916">
  <div style="font-size:22px;font-weight:800;font-style:italic;color:#3A9EA5;margin-bottom:16px">ddotsjobs<span style="color:#F5C842">.</span></div>
  <h2 style="font-size:18px;margin:0 0 12px">${heading}</h2>
  <div style="font-size:15px;line-height:1.5;color:#3a3a34">${bodyHtml}</div>
  <a href="${esc(cta.url)}" style="display:inline-block;margin-top:20px;background:#3A9EA5;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${esc(cta.label)}</a>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px"/>
  <p style="font-size:12px;color:#9a9a92;margin:0">
    You're receiving this because you have a ddotsjobs account.
    <a href="${esc(unsubscribeUrl)}" style="color:#9a9a92">Unsubscribe</a> ·
    <a href="${APP_URL}/seeker/preferences" style="color:#9a9a92">Email settings</a>
  </p>
</div>`;
}

function buildEmail(
  eventType: EventType,
  context: Record<string, unknown>,
  unsubscribeUrl: string,
): { subject: string; html: string } {
  switch (eventType) {
    case 'chat_message': {
      const sender = esc(context.senderName ?? 'Someone');
      const preview = esc(context.preview ?? '');
      const url = `${APP_URL}/chat/${esc(context.conversationId ?? '')}`;
      return {
        subject: `New message from ${context.senderName ?? 'someone'} — ddotsjobs`,
        html: shell(`${sender} sent you a message`, `<p style="background:#f4f4ef;padding:12px 14px;border-radius:10px">${preview}</p>`, { label: 'Reply', url }, unsubscribeUrl),
      };
    }
    case 'endorsement': {
      const who = esc(context.endorserName ?? 'Someone');
      const skill = esc(context.skillName ?? 'a skill');
      const n = Number(context.count ?? 0);
      return {
        subject: `${context.endorserName ?? 'Someone'} endorsed you for ${context.skillName ?? 'a skill'} — ddotsjobs`,
        html: shell(`${who} endorsed you for ${skill}`, `<p>You now have <strong>${n}</strong> endorsement${n === 1 ? '' : 's'} for ${skill}.</p>`, { label: 'View your profile', url: `${APP_URL}/seeker/profile` }, unsubscribeUrl),
      };
    }
    case 'job_expiry': {
      const title = esc(context.jobTitle ?? 'your job');
      const days = Number(context.daysLeft ?? 3);
      return {
        subject: `"${context.jobTitle ?? 'Your job'}" expires in ${days} days — ddotsjobs`,
        html: shell(`Your job posting is expiring`, `<p>“${title}” expires in <strong>${days} day${days === 1 ? '' : 's'}</strong>. Renew it to keep receiving applications.</p>`, { label: 'Renew job', url: `${APP_URL}/employer/jobs` }, unsubscribeUrl),
      };
    }
    case 'application': {
      const seeker = esc(context.seekerName ?? 'A candidate');
      const title = esc(context.jobTitle ?? 'your job');
      return {
        subject: `${context.seekerName ?? 'A candidate'} applied to ${context.jobTitle ?? 'your job'} — ddotsjobs`,
        html: shell(`New application received`, `<p><strong>${seeker}</strong> applied to “${title}”.</p>`, { label: 'View applicants', url: `${APP_URL}/employer/applicants` }, unsubscribeUrl),
      };
    }
  }
}

async function logResult(userId: string, eventType: string, email: string, subject: string, status: 'sent' | 'failed' | 'skipped', bounceReason?: string): Promise<void> {
  try {
    await db.insert(tables.emailLogs).values({ userId, eventType, recipientEmail: email, subject, status, bounceReason: bounceReason ?? null });
  } catch (err) {
    logger.error({ err }, '[email] failed to write email_logs');
  }
}

export const emailProcessor: Processor<JobPayloads['email']> = async (job: Job<JobPayloads['email']>) => {
  const { eventType, userId, context } = job.data;

  // 1. Global kill-switch (default OFF).
  if (!(await emailsActive())) return { status: 'skipped', reason: 'killswitch' as const };

  const cfg = CONFIG[eventType];

  // 2. Recipient must exist and have an email.
  const [user] = await db
    .select({ email: tables.users.email })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .limit(1);
  if (!user?.email) return { status: 'skipped', reason: 'no-email' as const };

  // 3. Per-user preference for this event type (get-or-create defaults).
  await db.insert(tables.emailPreferences).values({ userId }).onConflictDoNothing({ target: tables.emailPreferences.userId });
  const [prefs] = await db.select().from(tables.emailPreferences).where(eq(tables.emailPreferences.userId, userId)).limit(1);
  if (!prefs || prefs[cfg.prefColumn] !== true) {
    return { status: 'skipped', reason: 'opted-out' as const };
  }

  // 4. Rate limit per (user, event[, job]). Skip silently if within window.
  if (cfg.windowSec > 0) {
    const suffix = eventType === 'job_expiry' && context.jobId ? `:${String(context.jobId)}` : '';
    const key = `email:rl:${eventType}:${userId}${suffix}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, cfg.windowSec);
    if (n > 1) return { status: 'skipped', reason: 'rate-limited' as const };
  }

  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${prefs.unsubscribeToken}`;
  const { subject, html } = buildEmail(eventType, context, unsubscribeUrl);

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await logResult(userId, eventType, user.email, subject, 'failed', 'RESEND_API_KEY not set');
    return { status: 'failed', reason: 'no-key' as const };
  }

  try {
    await new Resend(key).emails.send({ from: FROM, to: user.email, subject, html });
    await logResult(userId, eventType, user.email, subject, 'sent');
    logger.info({ eventType, userId }, '[email] sent');
    return { status: 'sent' as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logResult(userId, eventType, user.email, subject, 'failed', msg);
    logger.error({ err, eventType, userId }, '[email] send failed');
    throw err; // let BullMQ retry (attempts: 2)
  }
};

// Register the daily 08:00 UTC+4 (04:00 UTC) job-expiry check on the
// maintenance queue (routed to runJobExpiryCheck by job.name).
export async function registerJobExpiryCron(): Promise<void> {
  await queues.maintenance.add(
    'job_expiry_check',
    {},
    { repeat: { pattern: '0 4 * * *' }, jobId: 'job-expiry-cron', removeOnComplete: true },
  );
}

// Daily cron: find active jobs expiring within 3 days and enqueue an expiry
// email to each employer owner. The per-job rate limit in emailProcessor stops
// the same job being emailed twice in a day.
export async function runJobExpiryCheck(): Promise<{ found: number; queued: number }> {
  const j = tables.jobs;
  const expiry = sql<Date>`coalesce(${j.expiresAt}, ${j.validThrough})`;
  const rows = await db
    .select({ id: j.id, title: j.titleEn, expiresAt: expiry, ownerUserId: tables.employers.ownerUserId })
    .from(j)
    .innerJoin(tables.employers, eq(tables.employers.id, j.employerId))
    .where(
      and(
        eq(j.status, 'active'),
        isNull(j.deletedAt),
        sql`coalesce(${j.expiresAt}, ${j.validThrough}) is not null`,
        sql`coalesce(${j.expiresAt}, ${j.validThrough}) between now() and now() + interval '3 days'`,
      ),
    );

  let queued = 0;
  for (const r of rows) {
    if (!r.ownerUserId) continue;
    const daysLeft = Math.max(1, Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / 86_400_000));
    await queues.email.add(
      'job_expiry',
      { eventType: 'job_expiry', userId: r.ownerUserId, context: { jobTitle: r.title, jobId: r.id, daysLeft } },
      { removeOnComplete: true },
    );
    queued++;
  }
  logger.info({ found: rows.length, queued }, '[email] job-expiry check complete');
  return { found: rows.length, queued };
}
