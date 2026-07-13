import { gzip as gzipCb } from 'node:zlib';
import { promisify } from 'node:util';
import { Resend } from 'resend';
import type { Job, Processor } from 'bullmq';
import { db, eq, or, tables } from '@ddotsjobs/db';
import { uploadFile } from '@ddotsjobs/storage';
import { logger } from '../lib/logger.js';
import type { JobPayloads } from '../queues.js';

const gzip = promisify(gzipCb);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ddotsjobs.com';
const FROM = process.env.OTP_FROM ?? 'ddotsjobs <noreply@ddotsjobs.com>';
const RETENTION_DAYS = 30;

type GdprPayload = JobPayloads['gdpr'];

// Transactional email (compliance) — sent regardless of notification prefs.
async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn({ subject }, 'RESEND_API_KEY not set — GDPR email skipped');
    return;
  }
  try {
    await new Resend(key).emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    logger.error({ err: (err as Error).message, subject }, 'GDPR email send failed');
  }
}

function auditWorker(actorUserId: string | null, action: string, diff: Record<string, unknown>): Promise<unknown> {
  return db
    .insert(tables.auditLog)
    .values({ actorUserId, action, entityType: 'user', entityId: actorUserId ?? undefined, diff })
    .catch((err) => logger.error({ err: (err as Error).message, action }, 'audit insert failed'));
}

// ── Data export ─────────────────────────────────────────────────────────
async function runExport(exportId: string, userId: string): Promise<void> {
  await db.update(tables.dataExportRequests).set({ status: 'processing' }).where(eq(tables.dataExportRequests.id, exportId));

  const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1);
  if (!user) throw new Error('user not found');
  // Never export auth secrets.
  const { passwordHash: _p, adminPasswordHash: _a, ...account } = user;

  const bundle: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    userId,
    format: 'json',
    account,
    seekerProfiles: await db.select().from(tables.seekerProfiles).where(eq(tables.seekerProfiles.userId, userId)),
    resumeProfiles: await db.select().from(tables.resumeProfiles).where(eq(tables.resumeProfiles.userId, userId)),
    savedJobs: await db.select().from(tables.savedJobs).where(eq(tables.savedJobs.userId, userId)),
    applications: await db.select().from(tables.applications).where(eq(tables.applications.seekerUserId, userId)),
    posts: await db.select().from(tables.posts).where(eq(tables.posts.userId, userId)),
    endorsementsGiven: await db.select().from(tables.skillEndorsements).where(eq(tables.skillEndorsements.endorserId, userId)),
    endorsementsReceived: await db.select().from(tables.skillEndorsements).where(eq(tables.skillEndorsements.endorseeId, userId)),
    conversations: await db
      .select()
      .from(tables.conversations)
      .where(or(eq(tables.conversations.participantA, userId), eq(tables.conversations.participantB, userId))),
    messages: await db.select().from(tables.messages).where(eq(tables.messages.senderId, userId)),
    pravasiProfiles: await db.select().from(tables.pravasiProfiles).where(eq(tables.pravasiProfiles.userId, userId)),
    notifications: await db.select().from(tables.notifications).where(eq(tables.notifications.userId, userId)),
    referralLinks: await db.select().from(tables.referralLinks).where(eq(tables.referralLinks.userId, userId)),
    referralCredits: await db.select().from(tables.referralCredits).where(eq(tables.referralCredits.userId, userId)),
    auditTrail: await db.select().from(tables.auditLog).where(eq(tables.auditLog.actorUserId, userId)),
  };

  const gz = await gzip(Buffer.from(JSON.stringify(bundle, null, 2), 'utf8'));
  const key = `gdpr-exports/${userId}/${exportId}.json.gz`;
  await uploadFile(key, gz, 'application/gzip');

  const expiresAt = new Date(Date.now() + RETENTION_DAYS * 86_400_000);
  await db
    .update(tables.dataExportRequests)
    .set({ status: 'ready', storageKey: key, sizeBytes: gz.length, completedAt: new Date(), expiresAt })
    .where(eq(tables.dataExportRequests.id, exportId));

  await auditWorker(userId, 'gdpr.export_ready', { exportId, sizeBytes: gz.length });

  if (user.email) {
    const link = `${APP_URL}/seeker/preferences/privacy`;
    await sendMail(
      user.email,
      'Your ddotsjobs data export is ready',
      shell(
        'Your data export is ready',
        `<p>We packaged a copy of your ddotsjobs data. You can download it from your privacy settings.</p>
         <p>The download link expires in <strong>${RETENTION_DAYS} days</strong>.</p>`,
        { label: 'Download my data', url: link },
      ),
    );
  }
}

// ── Right to be forgotten ─────────────────────────────────────────────────
async function runDeletion(deletionId: string, userId: string): Promise<void> {
  const [req] = await db
    .select()
    .from(tables.dataDeletionRequests)
    .where(eq(tables.dataDeletionRequests.id, deletionId))
    .limit(1);
  if (!req || req.status !== 'approved') {
    logger.warn({ deletionId, status: req?.status }, 'deletion job skipped — not approved');
    return;
  }

  const [user] = await db.select({ email: tables.users.email }).from(tables.users).where(eq(tables.users.id, userId)).limit(1);

  // Email the user BEFORE we scrub contact details.
  if (user?.email) {
    await sendMail(
      user.email,
      'Your ddotsjobs account has been deleted',
      shell(
        'Account deletion complete',
        `<p>As requested, your ddotsjobs account and personal data have been ${req.mode === 'hard' ? 'permanently erased' : 'deactivated and anonymised'}.</p>
         <p>Legally required audit records are retained. Thank you for using ddotsjobs.</p>`,
        { label: 'ddotsjobs.com', url: APP_URL },
      ),
    );
  }

  if (req.mode === 'hard') {
    // FK cascades remove related rows; audit_log.actor_user_id is ON DELETE SET NULL (preserved).
    await db.delete(tables.users).where(eq(tables.users.id, userId));
  } else {
    // Soft delete: deactivate + anonymise PII. The phone/email unique indexes are
    // partial (deleted_at IS NULL) so scrubbed values never collide.
    await db
      .update(tables.users)
      .set({
        deletedAt: new Date(),
        isBanned: true,
        banReason: 'gdpr_deletion',
        bannedAt: new Date(),
        nameEn: 'Deleted user',
        nameMl: null,
        email: null,
        phone: `deleted-${userId.slice(0, 8)}`,
        passwordHash: null,
        adminPasswordHash: null,
      })
      .where(eq(tables.users.id, userId));
  }

  await db
    .update(tables.dataDeletionRequests)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(tables.dataDeletionRequests.id, deletionId));

  // actorUserId null on hard delete (row gone) so the audit record survives.
  await auditWorker(req.mode === 'hard' ? null : userId, 'gdpr.account_deleted', { deletionId, mode: req.mode });
}

export const gdprProcessor: Processor<GdprPayload> = async (job: Job<GdprPayload>) => {
  const data = job.data;
  if (data.kind === 'export') {
    try {
      await runExport(data.exportId, data.userId);
    } catch (err) {
      await db
        .update(tables.dataExportRequests)
        .set({ status: 'failed', error: (err as Error).message.slice(0, 500) })
        .where(eq(tables.dataExportRequests.id, data.exportId))
        .catch(() => {});
      throw err;
    }
    return { ok: true };
  }
  await runDeletion(data.deletionId, data.userId);
  return { ok: true };
};

// Minimal branded email shell (mirrors email.worker's look).
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
function shell(heading: string, bodyHtml: string, cta: { label: string; url: string }): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1916">
  <div style="font-size:22px;font-weight:800;font-style:italic;color:#3A9EA5;margin-bottom:16px">ddotsjobs<span style="color:#F5C842">.</span></div>
  <h2 style="font-size:18px;margin:0 0 12px">${esc(heading)}</h2>
  <div style="font-size:15px;line-height:1.5;color:#3a3a34">${bodyHtml}</div>
  <a href="${esc(cta.url)}" style="display:inline-block;margin-top:20px;background:#3A9EA5;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${esc(cta.label)}</a>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px"/>
  <p style="font-size:12px;color:#9a9a92;margin:0">Sent by ddotsjobs.com regarding your data privacy request.</p>
</div>`;
}
