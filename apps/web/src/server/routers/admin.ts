import { z } from 'zod';
import { and, asc, count, createNotification, desc, eq, gte, ilike, isNull, ne, sql, tables } from '@ddotsjobs/db';
import { TRPCError } from '@trpc/server';
import { roleProcedure, router } from '../trpc.js';
import { alertsQueue, searchSyncQueue } from '../queue.js';

// Admin + super_admin only.
const adminProcedure = roleProcedure('admin', 'super_admin');

const companyNameSql = sql<string>`coalesce(${tables.employers.displayNameEn}, ${tables.employers.legalNameEn})`;

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
});
