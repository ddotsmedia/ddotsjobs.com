import { z } from 'zod';
import { and, asc, count, createNotification, desc, eq, gte, ilike, isNull, ne, sql, tables } from '@ddotsjobs/db';
import { TRPCError } from '@trpc/server';
import { callAI } from '@ddotsjobs/ai';
import { jobDetectFakePrompt, adminRevenueInsightsPrompt } from '@ddotsjobs/ai/prompts';
import { roleProcedure, router } from '../trpc.js';
import { alertsQueue, searchSyncQueue } from '../queue.js';
import { clearSettingCache } from '@/lib/site-settings';

// Cheap deterministic risk heuristics for the moderation queue (no AI call).
const PHONE_RE = /(\+?\d[\d\s-]{8,})/;
export function computeRiskFlags(job: {
  descriptionEn: string | null;
  salaryDisclosed: boolean;
  isVerified: boolean;
  employerRejections: number;
  riskScore: number | null;
}): { score: number; recommendation: 'approve' | 'review' | 'reject'; flags: { level: 'ok' | 'warn' | 'bad'; text: string }[] } {
  const flags: { level: 'ok' | 'warn' | 'bad'; text: string }[] = [];
  let score = 0;
  const desc = job.descriptionEn ?? '';
  if (PHONE_RE.test(desc)) { score += 40; flags.push({ level: 'bad', text: 'Phone number detected in description' }); }
  if (desc.length < 200) { score += 15; flags.push({ level: 'warn', text: 'Description under 200 chars' }); }
  if (!job.salaryDisclosed) { score += 15; flags.push({ level: 'warn', text: 'Salary not disclosed' }); }
  else flags.push({ level: 'ok', text: 'Salary disclosed' });
  if (job.isVerified) flags.push({ level: 'ok', text: 'Verified employer' });
  else { score += 20; flags.push({ level: 'warn', text: 'Unverified employer' }); }
  if (job.employerRejections > 2) { score += 20; flags.push({ level: 'bad', text: `${job.employerRejections} previous rejections` }); }
  const final = job.riskScore ?? Math.min(100, score);
  const recommendation = final > 60 ? 'reject' : final > 30 ? 'review' : 'approve';
  return { score: final, recommendation, flags };
}

// Admin + super_admin only.
const adminProcedure = roleProcedure('admin', 'super_admin');

const companyNameSql = sql<string>`coalesce(${tables.employers.displayNameEn}, ${tables.employers.legalNameEn})`;

// WhatsApp group config (Green API). Static for now; member counts are estimates.
const WHATSAPP_GROUPS = {
  groups: [
    { id: 'nursing', name: 'Nursing Jobs', category: 'nursing', memberCount: 15_000, districts: ['all'] },
    { id: 'it', name: 'IT Jobs Kerala', category: 'it', memberCount: 8_000, districts: ['ernakulam', 'thiruvananthapuram'] },
    { id: 'teaching', name: 'Teaching Jobs', category: 'teaching', memberCount: 12_000, districts: ['all'] },
    { id: 'government', name: 'Govt & PSC Jobs', category: 'government', memberCount: 25_000, districts: ['all'] },
    { id: 'gulf', name: 'Gulf Return Jobs', category: 'gulf_return', memberCount: 18_000, districts: ['all'] },
    { id: 'general', name: 'General Jobs', category: 'general', memberCount: 42_000, districts: ['all'] },
  ],
  totalGroups: 73,
  totalMembers: 120_000,
} as const;

export const adminRouter = router({
  metrics: adminProcedure.query(async ({ ctx }) => {
    const { jobs, users, employers, applications } = tables;
    const oneDay = sql`now() - interval '1 day'`;

    const [
      activeJobs,
      seekers,
      verifiedEmployers,
      pendingJobs,
      jobsToday,
      applicationsToday,
    ] = await Promise.all([
      ctx.db.select({ c: count() }).from(jobs).where(and(eq(jobs.status, 'active'), isNull(jobs.deletedAt))),
      ctx.db.select({ c: count() }).from(users).where(and(eq(users.role, 'seeker'), isNull(users.deletedAt))),
      ctx.db.select({ c: count() }).from(employers).where(and(eq(employers.verificationStatus, 'verified'), isNull(employers.deletedAt))),
      ctx.db.select({ c: count() }).from(jobs).where(and(eq(jobs.status, 'pending_review'), isNull(jobs.deletedAt))),
      ctx.db.select({ c: count() }).from(jobs).where(and(gte(jobs.createdAt, oneDay), isNull(jobs.deletedAt))),
      ctx.db.select({ c: count() }).from(applications).where(and(gte(applications.createdAt, oneDay), isNull(applications.withdrawnAt))),
    ]);

    return {
      totalActiveJobs: activeJobs[0]?.c ?? 0,
      totalSeekers: seekers[0]?.c ?? 0,
      verifiedEmployers: verifiedEmployers[0]?.c ?? 0,
      pendingJobs: pendingJobs[0]?.c ?? 0,
      jobsToday: jobsToday[0]?.c ?? 0,
      applicationsToday: applicationsToday[0]?.c ?? 0,
    };
  }),

  moderationQueue: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const { jobs, employers } = tables;
      return ctx.db
        .select({
          id: jobs.id,
          title: jobs.titleEn,
          district: jobs.district,
          category: jobs.categorySlug,
          salaryMinPaise: jobs.salaryMinPaise,
          salaryMaxPaise: jobs.salaryMaxPaise,
          salaryDisclosed: jobs.salaryDisclosed,
          description: jobs.descriptionEn,
          createdAt: jobs.createdAt,
          riskScore: jobs.riskScore,
          moderationNote: jobs.moderationNote,
          companyName: companyNameSql,
          isVerified: sql<boolean>`(${employers.verificationStatus} = 'verified')`,
          employerType: sql<string>`coalesce(${employers.employerTypeCode}, ${employers.type}::text)`,
          employerTotalJobs: sql<number>`(select count(*)::int from jobs jx where jx.employer_id = ${employers.id} and jx.deleted_at is null)`,
        })
        .from(jobs)
        .innerJoin(employers, eq(jobs.employerId, employers.id))
        .where(and(eq(jobs.status, 'pending_review'), isNull(jobs.deletedAt)))
        .orderBy(asc(jobs.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  approveJob: adminProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { jobs, employers } = tables;
      const [job] = await ctx.db
        .select({ id: jobs.id, slug: jobs.slug, title: jobs.titleEn, ownerUserId: employers.ownerUserId })
        .from(jobs)
        .innerJoin(employers, eq(jobs.employerId, employers.id))
        .where(and(eq(jobs.id, input.jobId), isNull(jobs.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });

      await ctx.db
        .update(jobs)
        .set({
          status: 'active',
          moderationStatus: 'approved',
          moderatedByUserId: ctx.user.id,
          moderatedAt: new Date(),
          publishedAt: sql`coalesce(${jobs.publishedAt}, now())`,
        })
        .where(eq(jobs.id, input.jobId));

      await alertsQueue.add('match_job_alerts', { jobId: input.jobId }, { priority: 10 });
      await searchSyncQueue.add('index', { jobId: input.jobId, action: 'index' });

      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: 'admin.job_approved',
        entityType: 'job',
        entityId: input.jobId,
      });

      await createNotification({
        userId: job.ownerUserId,
        type: 'job.approved',
        title: 'Job approved and live',
        titleMl: 'Job approve ചെയ്തു',
        body: `${job.title} is now live`,
        bodyMl: `${job.title} ഇപ്പോൾ live ആണ്`,
        actionUrl: '/employer/jobs',
      });
      return { success: true as const };
    }),

  rejectJob: adminProcedure
    .input(z.object({ jobId: z.string().uuid(), reason: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const { jobs, employers } = tables;
      const [job] = await ctx.db
        .select({ id: jobs.id, title: jobs.titleEn, ownerUserId: employers.ownerUserId })
        .from(jobs)
        .innerJoin(employers, eq(jobs.employerId, employers.id))
        .where(and(eq(jobs.id, input.jobId), isNull(jobs.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });

      await ctx.db
        .update(jobs)
        .set({
          status: 'rejected',
          moderationStatus: 'rejected',
          moderationNote: input.reason,
          moderatedByUserId: ctx.user.id,
          moderatedAt: new Date(),
        })
        .where(eq(jobs.id, input.jobId));

      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: 'admin.job_rejected',
        entityType: 'job',
        entityId: input.jobId,
        diff: { reason: input.reason },
      });

      await createNotification({
        userId: job.ownerUserId,
        type: 'job.rejected',
        title: 'Job not approved',
        titleMl: 'Job approve ആയില്ല',
        body: input.reason,
        actionUrl: '/employer/jobs',
      });
      return { success: true as const };
    }),

  newEmployers: adminProcedure.query(async ({ ctx }) => {
    const { employers, users } = tables;
    return ctx.db
      .select({
        id: employers.id,
        companyName: companyNameSql,
        employerType: sql<string>`coalesce(${employers.employerTypeCode}, ${employers.type}::text)`,
        district: employers.district,
        gstin: employers.gstin,
        createdAt: employers.createdAt,
        phone: users.phone,
        jobCount: sql<number>`(select count(*)::int from jobs j where j.employer_id = ${employers.id})`,
      })
      .from(employers)
      .innerJoin(users, eq(users.id, employers.ownerUserId))
      .where(and(eq(employers.verificationStatus, 'unverified'), isNull(employers.deletedAt)))
      .orderBy(desc(employers.createdAt))
      .limit(20);
  }),

  approveEmployer: adminProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { employers } = tables;
      const [emp] = await ctx.db
        .select({ id: employers.id, ownerUserId: employers.ownerUserId, name: companyNameSql })
        .from(employers)
        .where(and(eq(employers.id, input.employerId), isNull(employers.deletedAt)))
        .limit(1);
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employer not found' });

      await ctx.db
        .update(employers)
        .set({ verificationStatus: 'verified', verifiedAt: new Date() })
        .where(eq(employers.id, input.employerId));

      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: 'admin.employer_approved',
        entityType: 'employer',
        entityId: input.employerId,
      });

      await createNotification({
        userId: emp.ownerUserId,
        type: 'employer.verified',
        title: 'Account verified',
        titleMl: 'Account verified ആയി',
        body: `${emp.name} is now a verified employer`,
        bodyMl: `${emp.name} ഇപ്പോൾ verified employer ആണ്`,
        actionUrl: '/employer/dashboard',
      });
      return { success: true as const };
    }),

  districtCoverage: adminProcedure.query(async ({ ctx }) => {
    const { jobs } = tables;
    return ctx.db
      .select({ district: jobs.district, jobCount: sql<number>`count(*)::int` })
      .from(jobs)
      .where(and(eq(jobs.status, 'active'), isNull(jobs.deletedAt), sql`${jobs.district} is not null`))
      .groupBy(jobs.district)
      .orderBy(desc(sql`count(*)`));
  }),

  jobStats7d: adminProcedure.query(async ({ ctx }) => {
    const { jobs } = tables;
    const rows = await ctx.db
      .select({ date: sql<string>`to_char(date(${jobs.createdAt}), 'YYYY-MM-DD')`, jobCount: sql<number>`count(*)::int` })
      .from(jobs)
      .where(and(gte(jobs.createdAt, sql`now() - interval '7 days'`), isNull(jobs.deletedAt)))
      .groupBy(sql`date(${jobs.createdAt})`)
      .orderBy(asc(sql`date(${jobs.createdAt})`));
    return rows;
  }),

  recentAuditLog: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        action: tables.auditLog.action,
        entityType: tables.auditLog.entityType,
        createdAt: tables.auditLog.createdAt,
        actorName: sql<string | null>`coalesce(${tables.users.nameEn}, ${tables.users.phone})`,
      })
      .from(tables.auditLog)
      .leftJoin(tables.users, eq(tables.users.id, tables.auditLog.actorUserId))
      .orderBy(desc(tables.auditLog.createdAt))
      .limit(10);
  }),

  banUser: adminProcedure
    .input(z.object({ userId: z.string().uuid(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot ban yourself' });
      }
      await ctx.db
        .update(tables.users)
        .set({ isBanned: true, banReason: input.reason, bannedAt: new Date() })
        .where(eq(tables.users.id, input.userId));
      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: 'admin.user_banned',
        entityType: 'user',
        entityId: input.userId,
        diff: { reason: input.reason },
      });
      return { success: true as const };
    }),

  // ── Live activity feed (Part 2) — last 20 audit events ───────────────
  recentActivity: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        action: tables.auditLog.action,
        entityType: tables.auditLog.entityType,
        createdAt: tables.auditLog.createdAt,
        actorName: sql<string | null>`coalesce(${tables.users.nameEn}, ${tables.users.phone})`,
      })
      .from(tables.auditLog)
      .leftJoin(tables.users, eq(tables.users.id, tables.auditLog.actorUserId))
      .orderBy(desc(tables.auditLog.createdAt))
      .limit(20);
  }),

  // ── Site settings / feature flags (Part 9) ───────────────────────────
  getSiteSettings: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(tables.siteSettings).orderBy(asc(tables.siteSettings.key));
  }),

  updateSiteSetting: adminProcedure
    .input(z.object({ key: z.string().min(1).max(100), value: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(tables.siteSettings)
        .values({ key: input.key, value: input.value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: tables.siteSettings.key, set: { value: input.value, updatedAt: new Date() } });
      // Bust the cache so the new value takes effect immediately.
      await clearSettingCache(input.key);
      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: 'admin.setting_updated',
        entityType: 'site_setting',
        diff: { key: input.key, value: input.value },
      });
      return { success: true as const };
    }),

  // ── Employer suspension (Part 5 / Part 11) ───────────────────────────
  suspendEmployer: adminProcedure
    .input(z.object({ employerId: z.string().uuid(), reason: z.string().min(1).max(500), days: z.number().int().min(0).max(365).default(0) }))
    .mutation(async ({ ctx, input }) => {
      const endsAt = input.days > 0 ? new Date(Date.now() + input.days * 86_400_000) : null;
      await ctx.db
        .update(tables.employers)
        .set({ suspendedAt: new Date(), suspensionReason: input.reason, suspensionEndsAt: endsAt })
        .where(eq(tables.employers.id, input.employerId));
      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: 'admin.employer_suspended',
        entityType: 'employer',
        entityId: input.employerId,
        diff: { reason: input.reason, days: input.days },
      });
      return { success: true as const };
    }),

  unsuspendEmployer: adminProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tables.employers)
        .set({ suspendedAt: null, suspensionReason: null, suspensionEndsAt: null })
        .where(eq(tables.employers.id, input.employerId));
      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: 'admin.employer_unsuspended',
        entityType: 'employer',
        entityId: input.employerId,
      });
      return { success: true as const };
    }),

  // ── Employer management table (Part 5) ───────────────────────────────
  employerStats: adminProcedure.query(async ({ ctx }) => {
    const e = tables.employers;
    const base = isNull(e.deletedAt);
    const [total, pending, verified, suspended, paid] = await Promise.all([
      ctx.db.select({ c: count() }).from(e).where(base),
      ctx.db.select({ c: count() }).from(e).where(and(base, eq(e.verificationStatus, 'unverified'))),
      ctx.db.select({ c: count() }).from(e).where(and(base, eq(e.verificationStatus, 'verified'))),
      ctx.db.select({ c: count() }).from(e).where(and(base, sql`${e.suspendedAt} is not null`)),
      ctx.db.select({ c: count() }).from(e).where(and(base, ne(e.subscriptionTier, 'free'))),
    ]);
    return {
      total: total[0]?.c ?? 0, pending: pending[0]?.c ?? 0, verified: verified[0]?.c ?? 0,
      suspended: suspended[0]?.c ?? 0, paid: paid[0]?.c ?? 0,
    };
  }),

  getEmployers: adminProcedure
    .input(
      z.object({
        search: z.string().max(120).optional(),
        status: z.enum(['all', 'pending', 'verified', 'suspended']).default('all'),
        plan: z.enum(['all', 'free', 'paid']).default('all'),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const e = tables.employers;
      const conds = [isNull(e.deletedAt)];
      if (input.search?.trim()) conds.push(ilike(e.legalNameEn, `%${input.search.trim()}%`));
      if (input.status === 'pending') conds.push(eq(e.verificationStatus, 'unverified'));
      else if (input.status === 'verified') conds.push(eq(e.verificationStatus, 'verified'));
      else if (input.status === 'suspended') conds.push(sql`${e.suspendedAt} is not null`);
      if (input.plan === 'free') conds.push(eq(e.subscriptionTier, 'free'));
      else if (input.plan === 'paid') conds.push(ne(e.subscriptionTier, 'free'));

      return ctx.db
        .select({
          id: e.id,
          name: companyNameSql,
          typeCode: e.employerTypeCode,
          district: e.district,
          verificationStatus: e.verificationStatus,
          tier: e.subscriptionTier,
          suspendedAt: e.suspendedAt,
          createdAt: e.createdAt,
          phone: tables.users.phone,
          activeJobs: sql<number>`(select count(*)::int from ${tables.jobs} jj where jj.employer_id = ${e.id} and jj.status = 'active' and jj.deleted_at is null)`,
          totalJobs: sql<number>`(select count(*)::int from ${tables.jobs} jj where jj.employer_id = ${e.id} and jj.deleted_at is null)`,
          totalApplications: sql<number>`(select count(*)::int from ${tables.applications} aa where aa.employer_id = ${e.id})`,
        })
        .from(e)
        .innerJoin(tables.users, eq(tables.users.id, e.ownerUserId))
        .where(and(...conds))
        .orderBy(desc(e.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  getEmployerDetail: adminProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const e = tables.employers;
      const [employer] = await ctx.db
        .select({
          id: e.id,
          name: companyNameSql,
          typeCode: e.employerTypeCode,
          district: e.district,
          verificationStatus: e.verificationStatus,
          tier: e.subscriptionTier,
          suspendedAt: e.suspendedAt,
          suspensionReason: e.suspensionReason,
          gstin: e.gstin,
          websiteUrl: e.websiteUrl,
          companySize: e.companySize,
          yearEstablished: e.yearEstablished,
          contactName: e.contactName,
          createdAt: e.createdAt,
          phone: tables.users.phone,
          email: e.contactEmail,
        })
        .from(e)
        .innerJoin(tables.users, eq(tables.users.id, e.ownerUserId))
        .where(and(eq(e.id, input.employerId), isNull(e.deletedAt)))
        .limit(1);
      if (!employer) throw new TRPCError({ code: 'NOT_FOUND' });

      const [jobsList, payments, audit] = await Promise.all([
        ctx.db
          .select({ id: tables.jobs.id, slug: tables.jobs.slug, title: tables.jobs.titleEn, status: tables.jobs.status, applicationCount: tables.jobs.applicationCount, createdAt: tables.jobs.createdAt })
          .from(tables.jobs)
          .where(and(eq(tables.jobs.employerId, input.employerId), isNull(tables.jobs.deletedAt)))
          .orderBy(desc(tables.jobs.createdAt))
          .limit(10),
        ctx.db
          .select({ id: tables.payments.id, amountPaise: tables.payments.amountPaise, status: tables.payments.status, createdAt: tables.payments.createdAt })
          .from(tables.payments)
          .where(eq(tables.payments.employerId, input.employerId))
          .orderBy(desc(tables.payments.createdAt))
          .limit(20),
        ctx.db
          .select({ action: tables.auditLog.action, createdAt: tables.auditLog.createdAt, actorName: sql<string | null>`coalesce(${tables.users.nameEn}, ${tables.users.phone})` })
          .from(tables.auditLog)
          .leftJoin(tables.users, eq(tables.users.id, tables.auditLog.actorUserId))
          .where(and(eq(tables.auditLog.entityType, 'employer'), eq(tables.auditLog.entityId, input.employerId)))
          .orderBy(desc(tables.auditLog.createdAt))
          .limit(30),
      ]);
      const totalRevenue = payments.filter((p) => p.status === 'captured').reduce((s, p) => s + p.amountPaise, 0);
      return { employer, jobs: jobsList, payments, audit, totalRevenue };
    }),

  verifyEmployer: adminProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { employers } = tables;
      const [emp] = await ctx.db
        .select({ id: employers.id, ownerUserId: employers.ownerUserId, name: companyNameSql })
        .from(employers)
        .where(and(eq(employers.id, input.employerId), isNull(employers.deletedAt)))
        .limit(1);
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.db
        .update(employers)
        .set({ verificationStatus: 'verified', verifiedAt: new Date() })
        .where(eq(employers.id, input.employerId));
      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id, action: 'admin.employer_verified', entityType: 'employer', entityId: input.employerId,
      });
      await createNotification({
        userId: emp.ownerUserId,
        type: 'employer.verified',
        title: 'Account verified',
        titleMl: 'Account verified ആയി',
        body: `${emp.name} is now a verified employer`,
        bodyMl: `${emp.name} ഇപ്പോൾ verified employer ആണ്`,
        actionUrl: '/employer/dashboard',
      });
      return { success: true as const };
    }),

  unverifyEmployer: adminProcedure
    .input(z.object({ employerId: z.string().uuid(), reason: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tables.employers)
        .set({ verificationStatus: 'unverified', verifiedAt: null })
        .where(eq(tables.employers.id, input.employerId));
      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id, action: 'admin.employer_unverified', entityType: 'employer', entityId: input.employerId, diff: { reason: input.reason },
      });
      return { success: true as const };
    }),

  // ── Revenue & subscriptions (Part 8) ─────────────────────────────────
  revenueStats: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(3650).default(30) }))
    .query(async ({ ctx, input }) => {
      const since = sql`now() - make_interval(days => ${input.days})`;
      const p = tables.payments;
      const [pay] = await ctx.db
        .select({
          revenuePeriod: sql<number>`coalesce(sum(${p.amountPaise}) filter (where ${p.status} = 'captured' and ${p.createdAt} >= ${since}), 0)::bigint`,
          revenueTotal: sql<number>`coalesce(sum(${p.amountPaise}) filter (where ${p.status} = 'captured'), 0)::bigint`,
          revenuePrev: sql<number>`coalesce(sum(${p.amountPaise}) filter (where ${p.status} = 'captured' and ${p.createdAt} >= now() - make_interval(days => ${input.days * 2}) and ${p.createdAt} < ${since}), 0)::bigint`,
          txnPeriod: sql<number>`count(*) filter (where ${p.status} = 'captured' and ${p.createdAt} >= ${since})::int`,
          txnTotal: sql<number>`count(*) filter (where ${p.status} = 'captured')::int`,
          gstTotal: sql<number>`coalesce(sum(${p.gstAmountPaise}) filter (where ${p.status} = 'captured'), 0)::bigint`,
        })
        .from(p);
      const s = tables.subscriptions;
      const [subs] = await ctx.db
        .select({
          activeSubs: sql<number>`count(*)::int`,
          starter: sql<number>`count(*) filter (where ${s.tier} = 'employer_starter')::int`,
          growth: sql<number>`count(*) filter (where ${s.tier} = 'employer_growth')::int`,
          pro: sql<number>`count(*) filter (where ${s.tier} = 'hospital_pro')::int`,
          agency: sql<number>`count(*) filter (where ${s.tier} = 'agency')::int`,
        })
        .from(s)
        .where(and(eq(s.status, 'active'), sql`${s.currentPeriodEnd} > now()`));
      const pr = Number(pay?.revenuePrev ?? 0);
      const cur = Number(pay?.revenuePeriod ?? 0);
      const changePct = pr > 0 ? Math.round(((cur - pr) / pr) * 100) : null;
      return {
        revenuePeriodPaise: Number(pay?.revenuePeriod ?? 0),
        revenueTotalPaise: Number(pay?.revenueTotal ?? 0),
        transactionsPeriod: pay?.txnPeriod ?? 0,
        transactionsTotal: pay?.txnTotal ?? 0,
        gstTotalPaise: Number(pay?.gstTotal ?? 0),
        changePct,
        activeSubs: subs?.activeSubs ?? 0,
        starter: subs?.starter ?? 0,
        growth: subs?.growth ?? 0,
        pro: subs?.pro ?? 0,
        agency: subs?.agency ?? 0,
        razorpayConfigured: !!process.env.RAZORPAY_KEY_ID,
      };
    }),

  revenueTimeline: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(3650).default(30) }))
    .query(async ({ ctx, input }) => {
      const p = tables.payments;
      const d = sql<string>`to_char(date(${p.createdAt}), 'YYYY-MM-DD')`;
      return ctx.db
        .select({
          date: d,
          amountRupees: sql<number>`(coalesce(sum(${p.amountPaise}), 0) / 100)::int`,
          transactions: count(),
        })
        .from(p)
        .where(and(eq(p.status, 'captured'), gte(p.createdAt, sql`now() - make_interval(days => ${input.days})`)))
        .groupBy(d)
        .orderBy(d);
    }),

  revenueByPlan: adminProcedure.query(async ({ ctx }) => {
    const s = tables.subscriptions;
    const p = tables.payments;
    return ctx.db
      .select({
        tier: s.tier,
        subscriberCount: sql<number>`count(distinct ${s.id})::int`,
        revenueRupees: sql<number>`(coalesce(sum(${p.amountPaise}) filter (where ${p.status} = 'captured'), 0) / 100)::int`,
      })
      .from(s)
      .leftJoin(p, eq(p.subscriptionId, s.id))
      .groupBy(s.tier)
      .orderBy(desc(sql`coalesce(sum(${p.amountPaise}) filter (where ${p.status} = 'captured'), 0)`));
  }),

  getPayments: adminProcedure
    .input(z.object({ status: z.enum(['all', 'captured', 'failed', 'refunded']).default('all'), limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const p = tables.payments;
      const conds = input.status === 'all' ? [] : [eq(p.status, input.status)];
      return ctx.db
        .select({
          id: p.id,
          razorpayPaymentId: p.razorpayPaymentId,
          amountPaise: p.amountPaise,
          gstAmountPaise: p.gstAmountPaise,
          tier: tables.subscriptions.tier,
          status: p.status,
          createdAt: p.createdAt,
          companyName: companyNameSql,
          employerTypeCode: tables.employers.employerTypeCode,
        })
        .from(p)
        .leftJoin(tables.employers, eq(tables.employers.id, p.employerId))
        .leftJoin(tables.subscriptions, eq(tables.subscriptions.id, p.subscriptionId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(p.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  getSubscriptions: adminProcedure
    .input(z.object({ status: z.enum(['all', 'active', 'expired', 'cancelled']).default('active'), limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const s = tables.subscriptions;
      const conds = input.status === 'all' ? [] : [eq(s.status, input.status)];
      return ctx.db
        .select({
          id: s.id,
          tier: s.tier,
          status: s.status,
          currentPeriodStart: s.currentPeriodStart,
          currentPeriodEnd: s.currentPeriodEnd,
          createdAt: s.createdAt,
          companyName: companyNameSql,
          district: tables.employers.district,
          lastAmountPaise: sql<number | null>`(select amount_paise from payments pp where pp.employer_id = ${s.employerId} and pp.status = 'captured' order by pp.created_at desc limit 1)`,
        })
        .from(s)
        .innerJoin(tables.employers, eq(tables.employers.id, s.employerId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(s.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  exportPaymentsCSV: adminProcedure.query(async ({ ctx }) => {
    const p = tables.payments;
    const rows = await ctx.db
      .select({
        createdAt: p.createdAt,
        companyName: companyNameSql,
        tier: tables.subscriptions.tier,
        amountPaise: p.amountPaise,
        gstAmountPaise: p.gstAmountPaise,
        paymentId: p.razorpayPaymentId,
      })
      .from(p)
      .leftJoin(tables.employers, eq(tables.employers.id, p.employerId))
      .leftJoin(tables.subscriptions, eq(tables.subscriptions.id, p.subscriptionId))
      .where(eq(p.status, 'captured'))
      .orderBy(desc(p.createdAt))
      .limit(5000);
    const head = ['Date', 'Company', 'Plan', 'Amount (₹)', 'GST (₹)', 'Payment ID'];
    const body = rows.map((r) => [
      new Date(r.createdAt).toISOString().slice(0, 10),
      r.companyName ?? '',
      r.tier ?? '',
      (r.amountPaise / 100).toString(),
      (r.gstAmountPaise / 100).toString(),
      r.paymentId ?? '',
    ]);
    const csv = [head, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    return { csv };
  }),

  revenueInsights: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(3650).default(30) }))
    .mutation(async ({ ctx, input }) => {
      const s = tables.subscriptions;
      const p = tables.payments;
      const [tot] = await ctx.db
        .select({
          total: sql<number>`(coalesce(sum(${p.amountPaise}) filter (where ${p.status} = 'captured'), 0) / 100)::int`,
          period: sql<number>`(coalesce(sum(${p.amountPaise}) filter (where ${p.status} = 'captured' and ${p.createdAt} >= now() - make_interval(days => ${input.days})), 0) / 100)::int`,
        })
        .from(p);
      const [active] = await ctx.db.select({ c: count() }).from(s).where(and(eq(s.status, 'active'), sql`${s.currentPeriodEnd} > now()`));
      const byPlan = await ctx.db
        .select({ tier: s.tier, subscriberCount: sql<number>`count(distinct ${s.id})::int`, revenueRupees: sql<number>`(coalesce(sum(${p.amountPaise}) filter (where ${p.status} = 'captured'), 0) / 100)::int` })
        .from(s).leftJoin(p, eq(p.subscriptionId, s.id)).groupBy(s.tier);
      const spec = adminRevenueInsightsPrompt({
        totalRevenueRupees: tot?.total ?? 0,
        periodRevenueRupees: tot?.period ?? 0,
        activeSubs: active?.c ?? 0,
        revenueByPlan: byPlan.map((b) => ({ tier: b.tier, subscriberCount: b.subscriberCount, revenueRupees: b.revenueRupees })),
        days: input.days,
      });
      try {
        const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
        return data;
      } catch {
        return { insights: [] };
      }
    }),

  // ── WhatsApp broadcast (Part 7) ──────────────────────────────────────
  getWhatsAppGroups: adminProcedure.query(() => WHATSAPP_GROUPS),

  getBroadcastHistory: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: tables.broadcastLog.id,
          message: tables.broadcastLog.message,
          targetGroups: tables.broadcastLog.targetGroups,
          broadcastType: tables.broadcastLog.broadcastType,
          status: tables.broadcastLog.status,
          estimatedReach: tables.broadcastLog.estimatedReach,
          scheduledAt: tables.broadcastLog.scheduledAt,
          createdAt: tables.broadcastLog.createdAt,
          adminName: sql<string | null>`coalesce(${tables.users.nameEn}, ${tables.users.phone})`,
        })
        .from(tables.broadcastLog)
        .leftJoin(tables.users, eq(tables.users.id, tables.broadcastLog.sentByUserId))
        .orderBy(desc(tables.broadcastLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  broadcastStats: adminProcedure.query(async ({ ctx }) => {
    const [today] = await ctx.db
      .select({ c: count() })
      .from(tables.broadcastLog)
      .where(sql`${tables.broadcastLog.createdAt} >= date_trunc('day', now())`);
    return { todayCount: today?.c ?? 0, dailyLimit: 5 };
  }),

  sendBroadcast: adminProcedure
    .input(
      z.object({
        message: z.string().min(10).max(1000),
        targetGroups: z.array(z.string()).min(1),
        scheduleAt: z.string().optional(),
        broadcastType: z.enum(['announcement', 'job_alert', 'walk_in', 'maintenance', 'other']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Max 5 broadcasts per admin per day.
      const day = new Date().toISOString().slice(0, 10);
      const rlKey = `admin:broadcast:${ctx.user.id}:${day}`;
      const n = await ctx.redis.incr(rlKey);
      if (n === 1) await ctx.redis.expire(rlKey, 86_400);
      if (n > 5) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Daily broadcast limit (5) reached.' });

      const known = new Set<string>(WHATSAPP_GROUPS.groups.map((g) => g.id));
      const estimatedReach = WHATSAPP_GROUPS.groups
        .filter((g) => input.targetGroups.includes(g.id))
        .reduce((sum, g) => sum + g.memberCount, 0);
      if (input.targetGroups.some((g) => !known.has(g))) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown group' });

      const scheduledAt = input.scheduleAt ? new Date(input.scheduleAt) : null;
      const isFuture = scheduledAt != null && scheduledAt.getTime() > Date.now() + 60_000;
      const status = isFuture ? 'scheduled' : 'queued';

      const [row] = await ctx.db
        .insert(tables.broadcastLog)
        .values({
          message: input.message,
          targetGroups: input.targetGroups,
          broadcastType: input.broadcastType,
          status,
          estimatedReach,
          sentByUserId: ctx.user.id,
          scheduledAt: isFuture ? scheduledAt : null,
        })
        .returning({ id: tables.broadcastLog.id });

      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: isFuture ? 'admin.broadcast_scheduled' : 'admin.broadcast_queued',
        entityType: 'broadcast',
        entityId: row?.id,
        diff: { groups: input.targetGroups, estimatedReach },
      });
      // NB: actual WhatsApp delivery worker (Green API group send) is a follow-up.
      return isFuture
        ? { scheduled: true as const, scheduledAt: scheduledAt!.toISOString(), estimatedReach }
        : { queued: true as const, estimatedReach };
    }),

  cancelScheduledBroadcast: adminProcedure
    .input(z.object({ broadcastId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tables.broadcastLog)
        .set({ status: 'cancelled' })
        .where(and(eq(tables.broadcastLog.id, input.broadcastId), eq(tables.broadcastLog.status, 'scheduled'), eq(tables.broadcastLog.sentByUserId, ctx.user.id)));
      return { success: true as const };
    }),

  // ── Enhanced moderation (Part 4) ─────────────────────────────────────
  getModerationCount: adminProcedure.query(async ({ ctx }) => {
    const [r] = await ctx.db.select({ c: count() }).from(tables.jobs).where(and(eq(tables.jobs.status, 'pending_review'), isNull(tables.jobs.deletedAt)));
    return { count: r?.c ?? 0 };
  }),

  getModerationQueue: adminProcedure
    .input(
      z.object({
        sort: z.enum(['oldest', 'newest', 'highest_risk', 'lowest_risk']).default('oldest'),
        filter: z.enum(['all', 'high_risk', 'walk_in', 'no_salary', 'new_employer']).default('all'),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { jobs, employers } = tables;
      const conds = [eq(jobs.status, 'pending_review'), isNull(jobs.deletedAt)];
      if (input.filter === 'high_risk') conds.push(sql`${jobs.riskScore} > 50`);
      else if (input.filter === 'walk_in') conds.push(eq(jobs.isWalkIn, true));
      else if (input.filter === 'no_salary') conds.push(eq(jobs.salaryDisclosed, false));
      else if (input.filter === 'new_employer') conds.push(sql`${employers.createdAt} >= now() - interval '7 days'`);

      const order =
        input.sort === 'newest' ? desc(jobs.createdAt)
        : input.sort === 'highest_risk' ? sql`${jobs.riskScore} desc nulls last`
        : input.sort === 'lowest_risk' ? sql`${jobs.riskScore} asc nulls last`
        : asc(jobs.createdAt);

      const rows = await ctx.db
        .select({
          id: jobs.id,
          titleEn: jobs.titleEn,
          titleMl: jobs.titleMl,
          descriptionEn: jobs.descriptionEn,
          descriptionMl: jobs.descriptionMl,
          category: jobs.categorySlug,
          district: jobs.district,
          salaryMinPaise: jobs.salaryMinPaise,
          salaryMaxPaise: jobs.salaryMaxPaise,
          salaryDisclosed: jobs.salaryDisclosed,
          jobType: sql<string>`${jobs.type}::text`,
          isWalkIn: jobs.isWalkIn,
          valuesGulf: jobs.valuesGulfExperience,
          experienceMonths: jobs.minExperienceMonths,
          benefitsEn: jobs.benefitsEn,
          skills: jobs.skills,
          riskScore: jobs.riskScore,
          moderationNote: jobs.moderationNote,
          createdAt: jobs.createdAt,
          employerId: employers.id,
          companyName: companyNameSql,
          verificationStatus: employers.verificationStatus,
          employerTypeCode: sql<string>`coalesce(${employers.employerTypeCode}, ${employers.type}::text)`,
          employerCreatedAt: employers.createdAt,
          employerTotalJobs: sql<number>`(select count(*)::int from jobs jx where jx.employer_id = ${employers.id} and jx.deleted_at is null)`,
          employerRejections: sql<number>`(select count(*)::int from jobs jx where jx.employer_id = ${employers.id} and jx.status = 'rejected')`,
          employerActiveJobs: sql<number>`(select count(*)::int from jobs jx where jx.employer_id = ${employers.id} and jx.status = 'active' and jx.deleted_at is null)`,
        })
        .from(jobs)
        .innerJoin(employers, eq(jobs.employerId, employers.id))
        .where(and(...conds))
        .orderBy(order)
        .limit(input.limit)
        .offset(input.offset);

      return rows.map((r) => ({
        ...r,
        isVerified: r.verificationStatus === 'verified',
        risk: computeRiskFlags({
          descriptionEn: r.descriptionEn,
          salaryDisclosed: r.salaryDisclosed,
          isVerified: r.verificationStatus === 'verified',
          employerRejections: r.employerRejections,
          riskScore: r.riskScore,
        }),
      }));
    }),

  recentlyModerated: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: tables.jobs.id,
        title: tables.jobs.titleEn,
        moderationStatus: tables.jobs.moderationStatus,
        moderatedAt: tables.jobs.moderatedAt,
        adminName: sql<string | null>`coalesce(${tables.users.nameEn}, ${tables.users.phone})`,
      })
      .from(tables.jobs)
      .leftJoin(tables.users, eq(tables.users.id, tables.jobs.moderatedByUserId))
      .where(sql`${tables.jobs.moderatedAt} is not null`)
      .orderBy(desc(tables.jobs.moderatedAt))
      .limit(10);
  }),

  analyzeJobRisk: adminProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const cacheKey = `ai:jobrisk:${input.jobId}`;
      const cached = await ctx.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as { score: number; recommendation: string; flags: { level: string; text: string }[] };
      const [job] = await ctx.db
        .select({ titleEn: tables.jobs.titleEn, descriptionEn: tables.jobs.descriptionEn, salaryMinPaise: tables.jobs.salaryMinPaise, category: tables.jobs.categorySlug, employerType: sql<string>`coalesce(${tables.employers.employerTypeCode}, ${tables.employers.type}::text)` })
        .from(tables.jobs)
        .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
        .where(eq(tables.jobs.id, input.jobId))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });
      const spec = jobDetectFakePrompt({
        titleEn: job.titleEn,
        descriptionEn: job.descriptionEn ?? '',
        salaryMinPaise: job.salaryMinPaise,
        category: job.category ?? '',
        employerType: job.employerType,
      });
      try {
        const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
        await ctx.redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);
        return data;
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI analysis failed' });
      }
    }),

  approveJobWithEdit: adminProcedure
    .input(z.object({ jobId: z.string().uuid(), editedDescriptionEn: z.string().optional(), editedDescriptionMl: z.string().optional(), adminNote: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { jobs, employers } = tables;
      const [job] = await ctx.db
        .select({ id: jobs.id, slug: jobs.slug, title: jobs.titleEn, ownerUserId: employers.ownerUserId })
        .from(jobs)
        .innerJoin(employers, eq(jobs.employerId, employers.id))
        .where(and(eq(jobs.id, input.jobId), isNull(jobs.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });

      await ctx.db
        .update(jobs)
        .set({
          status: 'active',
          moderationStatus: 'approved',
          descriptionEn: input.editedDescriptionEn ?? sql`${jobs.descriptionEn}`,
          descriptionMl: input.editedDescriptionMl ?? sql`${jobs.descriptionMl}`,
          moderationNote: input.adminNote ?? sql`${jobs.moderationNote}`,
          moderatedByUserId: ctx.user.id,
          moderatedAt: new Date(),
          publishedAt: sql`coalesce(${jobs.publishedAt}, now())`,
        })
        .where(eq(jobs.id, input.jobId));

      await alertsQueue.add('match_job_alerts', { jobId: input.jobId }, { priority: 10 });
      await searchSyncQueue.add('index', { jobId: input.jobId, action: 'index' });
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin.job_approved_edit', entityType: 'job', entityId: input.jobId, diff: { edited: !!input.editedDescriptionEn || !!input.editedDescriptionMl } });
      await createNotification({ userId: job.ownerUserId, type: 'job.approved', title: 'Job approved and live', titleMl: 'Job approve ചെയ്തു', body: `${job.title} is now live`, bodyMl: `${job.title} ഇപ്പോൾ live ആണ്`, actionUrl: '/employer/jobs' });
      return { success: true as const };
    }),

  bulkApprove: adminProcedure
    .input(z.object({ jobIds: z.array(z.string().uuid()).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const { jobs, employers } = tables;
      let approved = 0, failed = 0;
      for (const jobId of input.jobIds) {
        try {
          const [job] = await ctx.db
            .select({ id: jobs.id, title: jobs.titleEn, ownerUserId: employers.ownerUserId })
            .from(jobs).innerJoin(employers, eq(jobs.employerId, employers.id))
            .where(and(eq(jobs.id, jobId), eq(jobs.status, 'pending_review'), isNull(jobs.deletedAt))).limit(1);
          if (!job) { failed++; continue; }
          await ctx.db.update(jobs).set({ status: 'active', moderationStatus: 'approved', moderatedByUserId: ctx.user.id, moderatedAt: new Date(), publishedAt: sql`coalesce(${jobs.publishedAt}, now())` }).where(eq(jobs.id, jobId));
          await alertsQueue.add('match_job_alerts', { jobId }, { priority: 10 });
          await searchSyncQueue.add('index', { jobId, action: 'index' });
          await createNotification({ userId: job.ownerUserId, type: 'job.approved', title: 'Job approved and live', titleMl: 'Job approve ചെയ്തു', body: `${job.title} is now live`, bodyMl: `${job.title} ഇപ്പോൾ live ആണ്`, actionUrl: '/employer/jobs' });
          approved++;
        } catch { failed++; }
      }
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin.bulk_approve', entityType: 'job', diff: { approved, failed } });
      return { approved, failed };
    }),

  bulkReject: adminProcedure
    .input(z.object({ jobIds: z.array(z.string().uuid()).max(50), reason: z.string().min(10).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { jobs, employers } = tables;
      let rejected = 0;
      for (const jobId of input.jobIds) {
        try {
          const [job] = await ctx.db
            .select({ id: jobs.id, title: jobs.titleEn, ownerUserId: employers.ownerUserId })
            .from(jobs).innerJoin(employers, eq(jobs.employerId, employers.id))
            .where(and(eq(jobs.id, jobId), eq(jobs.status, 'pending_review'), isNull(jobs.deletedAt))).limit(1);
          if (!job) continue;
          await ctx.db.update(jobs).set({ status: 'rejected', moderationStatus: 'rejected', moderationNote: input.reason, moderatedByUserId: ctx.user.id, moderatedAt: new Date() }).where(eq(jobs.id, jobId));
          await createNotification({ userId: job.ownerUserId, type: 'job.rejected', title: 'Job not approved', titleMl: 'Job approve ആയില്ല', body: input.reason, actionUrl: '/employer/jobs' });
          rejected++;
        } catch { /* skip */ }
      }
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin.bulk_reject', entityType: 'job', diff: { rejected, reason: input.reason } });
      return { rejected };
    }),

  addModerationNote: adminProcedure
    .input(z.object({ jobId: z.string().uuid(), note: z.string().min(5).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(tables.jobs).set({ moderationNote: input.note }).where(eq(tables.jobs.id, input.jobId));
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin.moderation_note', entityType: 'job', entityId: input.jobId, diff: { note: input.note } });
      return { success: true as const };
    }),

  // ── Seeker management (Part 6) ───────────────────────────────────────
  seekerStats: adminProcedure.query(async ({ ctx }) => {
    const u = tables.users;
    const base = and(eq(u.role, 'seeker'), isNull(u.deletedAt));
    const week = sql`now() - interval '7 days'`;
    const [total, verified, newWeek, banned, activeWeek] = await Promise.all([
      ctx.db.select({ c: count() }).from(u).where(base),
      ctx.db.select({ c: count() }).from(u).where(and(base, eq(u.isVerifiedProfessional, true))),
      ctx.db.select({ c: count() }).from(u).where(and(base, gte(u.createdAt, week))),
      ctx.db.select({ c: count() }).from(u).where(and(base, eq(u.isBanned, true))),
      ctx.db.select({ c: count() }).from(u).where(and(base, sql`${u.lastLoginAt} >= ${week}`)),
    ]);
    return {
      total: total[0]?.c ?? 0, verified: verified[0]?.c ?? 0, newThisWeek: newWeek[0]?.c ?? 0,
      banned: banned[0]?.c ?? 0, activeWeek: activeWeek[0]?.c ?? 0,
    };
  }),

  getSeekers: adminProcedure
    .input(
      z.object({
        search: z.string().max(120).optional(),
        status: z.enum(['all', 'verified', 'active', 'new', 'banned']).default('all'),
        category: z.string().max(60).optional(),
        district: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const u = tables.users;
      const sp = tables.seekerProfiles;
      const week = sql`now() - interval '7 days'`;
      const conds = [eq(u.role, 'seeker'), isNull(u.deletedAt)];
      if (input.search?.trim()) {
        const term = `%${input.search.trim()}%`;
        conds.push(sql`(${u.nameEn} ilike ${term} or ${u.primaryProfession} ilike ${term})`);
      }
      if (input.status === 'verified') conds.push(eq(u.isVerifiedProfessional, true));
      else if (input.status === 'active') conds.push(sql`${u.lastLoginAt} >= ${week}`);
      else if (input.status === 'new') conds.push(gte(u.createdAt, week));
      else if (input.status === 'banned') conds.push(eq(u.isBanned, true));
      if (input.category) conds.push(sql`${sp.preferredCategories} ? ${input.category}`);
      if (input.district) conds.push(sql`${sp.currentDistrict}::text = ${input.district}`);

      return ctx.db
        .select({
          id: u.id,
          name: sql<string | null>`coalesce(${u.nameEn}, ${u.primaryProfession})`,
          isVerified: u.isVerifiedProfessional,
          isBanned: u.isBanned,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
          district: sp.currentDistrict,
          profession: u.primaryProfession,
          experienceMonths: sp.totalExperienceMonths,
          completionPct: sp.completionPct,
          applicationsCount: sql<number>`(select count(*)::int from ${tables.applications} aa where aa.seeker_user_id = ${u.id} and aa.withdrawn_at is null)`,
        })
        .from(u)
        .leftJoin(sp, eq(sp.userId, u.id))
        .where(and(...conds))
        .orderBy(desc(u.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  getSeekerDetail: adminProcedure
    .input(z.object({ seekerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const u = tables.users;
      const sp = tables.seekerProfiles;
      const [seeker] = await ctx.db
        .select({
          id: u.id,
          name: sql<string | null>`coalesce(${u.nameEn}, ${u.primaryProfession})`,
          isVerified: u.isVerifiedProfessional,
          isBanned: u.isBanned,
          banReason: u.banReason,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
          profession: u.primaryProfession,
          district: sp.currentDistrict,
          experienceMonths: sp.totalExperienceMonths,
          completionPct: sp.completionPct,
          preferredCategories: sp.preferredCategories,
          openToGulf: sp.openToGulf,
        })
        .from(u)
        .leftJoin(sp, eq(sp.userId, u.id))
        .where(and(eq(u.id, input.seekerId), eq(u.role, 'seeker'), isNull(u.deletedAt)))
        .limit(1);
      if (!seeker) throw new TRPCError({ code: 'NOT_FOUND' });

      const [apps, certs, audit, alertsCount] = await Promise.all([
        ctx.db
          .select({ id: tables.applications.id, status: tables.applications.status, createdAt: tables.applications.createdAt, jobTitle: tables.jobs.titleEn, district: tables.jobs.district })
          .from(tables.applications)
          .innerJoin(tables.jobs, eq(tables.jobs.id, tables.applications.jobId))
          .where(and(eq(tables.applications.seekerUserId, input.seekerId), isNull(tables.applications.withdrawnAt)))
          .orderBy(desc(tables.applications.createdAt))
          .limit(10),
        ctx.db
          .select({ id: tables.professionalRegistrations.id, type: tables.professionalRegistrations.type, number: tables.professionalRegistrations.registrationNumber, status: tables.professionalRegistrations.status, createdAt: tables.professionalRegistrations.createdAt })
          .from(tables.professionalRegistrations)
          .where(eq(tables.professionalRegistrations.userId, input.seekerId))
          .orderBy(desc(tables.professionalRegistrations.createdAt)),
        ctx.db
          .select({ action: tables.auditLog.action, createdAt: tables.auditLog.createdAt, actorName: sql<string | null>`coalesce(${tables.users.nameEn}, ${tables.users.phone})` })
          .from(tables.auditLog)
          .leftJoin(tables.users, eq(tables.users.id, tables.auditLog.actorUserId))
          .where(and(eq(tables.auditLog.entityType, 'user'), eq(tables.auditLog.entityId, input.seekerId)))
          .orderBy(desc(tables.auditLog.createdAt))
          .limit(10),
        ctx.db.select({ c: count() }).from(tables.alertSubscriptions).where(eq(tables.alertSubscriptions.seekerUserId, input.seekerId)),
      ]);
      return { seeker, applications: apps, certifications: certs, audit, alertsCount: alertsCount[0]?.c ?? 0 };
    }),

  verifyProfessional: adminProcedure
    .input(z.object({ seekerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(tables.users).set({ isVerifiedProfessional: true }).where(eq(tables.users.id, input.seekerId));
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin.professional_verified', entityType: 'user', entityId: input.seekerId });
      await createNotification({
        userId: input.seekerId, type: 'profile.verified',
        title: 'Professional status verified', titleMl: 'Professional status verified ആയി ✓',
        body: 'Your professional status is now verified.', bodyMl: 'നിങ്ങളുടെ professional status verified ആയി.',
        actionUrl: '/seeker/profile',
      });
      return { success: true as const };
    }),

  unverifyProfessional: adminProcedure
    .input(z.object({ seekerId: z.string().uuid(), reason: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(tables.users).set({ isVerifiedProfessional: false }).where(eq(tables.users.id, input.seekerId));
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin.professional_unverified', entityType: 'user', entityId: input.seekerId, diff: { reason: input.reason } });
      return { success: true as const };
    }),

  banSeeker: adminProcedure
    .input(z.object({ seekerId: z.string().uuid(), reason: z.string().min(10).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (input.seekerId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot ban yourself' });
      await ctx.db.update(tables.users).set({ isBanned: true, banReason: input.reason, bannedAt: new Date() }).where(eq(tables.users.id, input.seekerId));
      // Drop the server-side session so the ban takes effect immediately.
      try { await ctx.redis.del(`session:${input.seekerId}`); } catch { /* ignore */ }
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin.seeker_banned', entityType: 'user', entityId: input.seekerId, diff: { reason: input.reason } });
      return { success: true as const };
    }),

  unbanSeeker: adminProcedure
    .input(z.object({ seekerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(tables.users).set({ isBanned: false, banReason: null, bannedAt: null }).where(eq(tables.users.id, input.seekerId));
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin.seeker_unbanned', entityType: 'user', entityId: input.seekerId });
      await createNotification({
        userId: input.seekerId, type: 'account.unbanned',
        title: 'Account reinstated', titleMl: 'Account പുനഃസ്ഥാപിച്ചു',
        body: 'Your account has been reinstated.', bodyMl: 'നിങ്ങളുടെ account പുനഃസ്ഥാപിച്ചു.',
        actionUrl: '/seeker/dashboard',
      });
      return { success: true as const };
    }),

  verifyCert: adminProcedure
    .input(z.object({ certId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(tables.professionalRegistrations).set({ status: 'verified' }).where(eq(tables.professionalRegistrations.id, input.certId));
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin.cert_verified', entityType: 'professional_registration', entityId: input.certId });
      return { success: true as const };
    }),

  // ── Platform analytics (Part 3) — all charts in one call ─────────────
  analyticsOverview: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(366).default(30) }))
    .query(async ({ ctx, input }) => {
      const { jobs, users, employers, applications } = tables;
      const since = sql`now() - make_interval(days => ${input.days})`;
      const jDate = sql<string>`to_char(date(${jobs.createdAt}), 'YYYY-MM-DD')`;
      const uDate = sql<string>`to_char(date(${users.createdAt}), 'YYYY-MM-DD')`;

      const [
        platform,
        jobsTimeline,
        registrationsTimeline,
        jobsByCategory,
        jobsByDistrict,
        applicationFunnel,
        seekersByProfession,
        salaryRow,
      ] = await Promise.all([
        // Platform stats (single roundtrip via subquery counts).
        ctx.db
          .select({
            totalJobs: sql<number>`(select count(*)::int from ${jobs} where deleted_at is null)`,
            activeJobs: sql<number>`(select count(*)::int from ${jobs} where deleted_at is null and status = 'active')`,
            totalSeekers: sql<number>`(select count(*)::int from ${users} where deleted_at is null and role = 'seeker')`,
            totalEmployers: sql<number>`(select count(*)::int from ${employers} where deleted_at is null)`,
            verifiedEmployers: sql<number>`(select count(*)::int from ${employers} where deleted_at is null and verification_status = 'verified')`,
            totalApplications: sql<number>`(select count(*)::int from ${applications} where withdrawn_at is null)`,
            placements: sql<number>`(select count(*)::int from ${applications} where status = 'hired')`,
          })
          .from(sql`(select 1) as _`),
        ctx.db
          .select({ date: jDate, count: count() })
          .from(jobs)
          .where(and(gte(jobs.createdAt, since), isNull(jobs.deletedAt)))
          .groupBy(jDate)
          .orderBy(jDate),
        ctx.db
          .select({
            date: uDate,
            seekers: sql<number>`sum(case when ${users.role} = 'seeker' then 1 else 0 end)::int`,
            employers: sql<number>`sum(case when ${users.role} = 'employer' then 1 else 0 end)::int`,
          })
          .from(users)
          .where(and(gte(users.createdAt, since), isNull(users.deletedAt)))
          .groupBy(uDate)
          .orderBy(uDate),
        ctx.db
          .select({ category: jobs.categorySlug, count: count() })
          .from(jobs)
          .where(and(isNull(jobs.deletedAt), eq(jobs.status, 'active')))
          .groupBy(jobs.categorySlug)
          .orderBy(desc(count()))
          .limit(12),
        ctx.db
          .select({ district: jobs.district, count: count() })
          .from(jobs)
          .where(and(isNull(jobs.deletedAt), eq(jobs.status, 'active')))
          .groupBy(jobs.district)
          .orderBy(desc(count())),
        ctx.db
          .select({ status: applications.status, count: count() })
          .from(applications)
          .where(isNull(applications.withdrawnAt))
          .groupBy(applications.status),
        ctx.db
          .select({ profession: users.primaryProfession, count: count() })
          .from(users)
          .where(and(eq(users.role, 'seeker'), isNull(users.deletedAt), sql`${users.primaryProfession} is not null`))
          .groupBy(users.primaryProfession)
          .orderBy(desc(count()))
          .limit(10),
        ctx.db
          .select({
            disclosed: sql<number>`sum(case when ${jobs.salaryDisclosed} and ${jobs.salaryMinPaise} is not null then 1 else 0 end)::int`,
            total: count(),
          })
          .from(jobs)
          .where(and(isNull(jobs.deletedAt), eq(jobs.status, 'active'))),
      ]);

      const sal = salaryRow[0] ?? { disclosed: 0, total: 0 };
      return {
        days: input.days,
        platform: platform[0]!,
        jobsTimeline,
        registrationsTimeline,
        jobsByCategory,
        jobsByDistrict,
        applicationFunnel,
        seekersByProfession,
        salaryDisclosedPct: sal.total > 0 ? Math.round((sal.disclosed / sal.total) * 100) : 0,
      };
    }),
});
