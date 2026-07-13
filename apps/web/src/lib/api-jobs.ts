import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { and, db, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { isEnabled } from '@/lib/site-settings';
import { stripHtml, sanitizeHtml } from '@/lib/sanitize';
import { alertsQueue, searchSyncQueue } from '@/server/queue';
import { notifyGoogleIndexing } from '@/lib/google-indexing';
import { emitWebhookEvent } from '@/lib/webhooks';
import { emitIntegrationEvent } from '@/lib/integrations';

const DISTRICTS = [
  'thiruvananthapuram', 'kollam', 'pathanamthitta', 'alappuzha', 'kottayam', 'idukki', 'ernakulam',
  'thrissur', 'palakkad', 'malappuram', 'kozhikode', 'wayanad', 'kannur', 'kasaragod',
] as const;
const JOB_TYPES = ['full_time', 'part_time', 'contract', 'internship', 'walk_in'] as const;

// Salaries are accepted as whole RUPEES/month and stored as paise.
export const apiJobInput = z
  .object({
    title: z.string().min(3).max(255),
    description: z.string().min(10).max(5000),
    category: z.string().min(1).max(100),
    district: z.enum(DISTRICTS),
    jobType: z.enum(JOB_TYPES).default('full_time'),
    salaryMin: z.number().int().nonnegative().max(100_000_000),
    salaryMax: z.number().int().nonnegative().max(100_000_000),
    salaryDisclosed: z.boolean().default(true),
    minExperienceMonths: z.number().int().min(0).max(600).default(0),
    requirements: z.string().max(5000).optional(),
    validThrough: z.string().datetime().optional(),
  })
  .refine((v) => v.salaryMax >= v.salaryMin, { message: 'salaryMax must be ≥ salaryMin', path: ['salaryMax'] });

export type ApiJobInput = z.infer<typeof apiJobInput>;

export const apiJobUpdateInput = z
  .object({
    title: z.string().min(3).max(255).optional(),
    description: z.string().min(10).max(5000).optional(),
    salaryMin: z.number().int().nonnegative().max(100_000_000).optional(),
    salaryMax: z.number().int().nonnegative().max(100_000_000).optional(),
    salaryDisclosed: z.boolean().optional(),
    validThrough: z.string().datetime().nullable().optional(),
  })
  .strict();
export type ApiJobUpdateInput = z.infer<typeof apiJobUpdateInput>;

function jobSlug(title: string, district: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'job';
  return `${base}-${district}-${randomBytes(3).toString('hex')}`;
}

export type CreateResult =
  | { ok: true; jobId: string; status: string; slug: string }
  | { ok: false; status: number; message: string };

export async function createJobViaApi(employerId: string, ownerUserId: string, input: ApiJobInput): Promise<CreateResult> {
  const [emp] = await db
    .select({ verificationStatus: tables.employers.verificationStatus, jobsPosted: tables.employers.jobsPostedThisPeriod, jobsLimit: tables.employers.jobsLimitThisPeriod })
    .from(tables.employers)
    .where(eq(tables.employers.id, employerId))
    .limit(1);
  if (!emp) return { ok: false, status: 404, message: 'Employer not found' };
  if (emp.jobsPosted >= emp.jobsLimit) return { ok: false, status: 403, message: 'Job post limit reached for this period. Upgrade your plan.' };

  const verified = emp.verificationStatus === 'verified';
  const modRequired = await isEnabled('job_moderation_required', true);
  const autoApprove = await isEnabled('auto_approve_verified', false);
  const status: 'active' | 'pending_review' = !modRequired ? 'active' : autoApprove && verified ? 'active' : 'pending_review';
  const slug = jobSlug(input.title, input.district);
  const now = new Date();

  const [row] = await db
    .insert(tables.jobs)
    .values({
      employerId,
      slug,
      titleEn: stripHtml(input.title),
      descriptionEn: sanitizeHtml(input.description),
      requirementsEn: input.requirements ?? null,
      type: input.jobType,
      status,
      district: input.district,
      categorySlug: input.category,
      salaryMinPaise: input.salaryMin * 100,
      salaryMaxPaise: input.salaryMax * 100,
      salaryDisclosed: input.salaryDisclosed,
      minExperienceMonths: input.minExperienceMonths,
      validThrough: input.validThrough ? new Date(input.validThrough) : null,
      publishedAt: status === 'active' ? now : null,
    })
    .returning({ id: tables.jobs.id });
  if (!row) return { ok: false, status: 500, message: 'Failed to create job' };

  await db.update(tables.employers).set({ jobsPostedThisPeriod: sql`${tables.employers.jobsPostedThisPeriod} + 1` }).where(eq(tables.employers.id, employerId));

  if (status === 'active') {
    await alertsQueue.add('match_job_alerts', { jobId: row.id }, { priority: 10 }).catch(() => {});
    await searchSyncQueue.add('index', { jobId: row.id, action: 'index' }).catch(() => {});
    void notifyGoogleIndexing(`https://ddotsjobs.com/jobs/${slug}`);
  }
  await db.insert(tables.auditLog).values({ actorUserId: ownerUserId, action: 'job.created_api', entityType: 'job', entityId: row.id }).catch(() => {});
  await emitWebhookEvent(employerId, 'job_posted', { jobId: row.id, title: input.title, url: `https://ddotsjobs.com/jobs/${slug}` });
  await emitIntegrationEvent(employerId, 'job_posted', { jobId: row.id, title: input.title, url: `https://ddotsjobs.com/jobs/${slug}` });

  return { ok: true, jobId: row.id, status, slug };
}

// Update an employer-owned job. Returns false if not owned.
export async function updateJobViaApi(employerId: string, jobId: string, input: ApiJobUpdateInput): Promise<boolean> {
  const [job] = await db.select({ id: tables.jobs.id }).from(tables.jobs).where(and(eq(tables.jobs.id, jobId), eq(tables.jobs.employerId, employerId), isNull(tables.jobs.deletedAt))).limit(1);
  if (!job) return false;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) set.titleEn = stripHtml(input.title);
  if (input.description !== undefined) set.descriptionEn = sanitizeHtml(input.description);
  if (input.salaryMin !== undefined) set.salaryMinPaise = input.salaryMin * 100;
  if (input.salaryMax !== undefined) set.salaryMaxPaise = input.salaryMax * 100;
  if (input.salaryDisclosed !== undefined) set.salaryDisclosed = input.salaryDisclosed;
  if (input.validThrough !== undefined) set.validThrough = input.validThrough ? new Date(input.validThrough) : null;
  await db.update(tables.jobs).set(set).where(eq(tables.jobs.id, jobId));
  return true;
}

export async function deleteJobViaApi(employerId: string, jobId: string): Promise<boolean> {
  const [job] = await db.select({ id: tables.jobs.id }).from(tables.jobs).where(and(eq(tables.jobs.id, jobId), eq(tables.jobs.employerId, employerId), isNull(tables.jobs.deletedAt))).limit(1);
  if (!job) return false;
  await db.update(tables.jobs).set({ deletedAt: new Date(), status: 'closed', closedAt: new Date() }).where(eq(tables.jobs.id, jobId));
  return true;
}
