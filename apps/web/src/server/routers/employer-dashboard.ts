import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, inArray, isNull, sql, tables, type Database } from '@ddotsjobs/db';
import { roleProcedure, router } from '../trpc.js';

const emp = roleProcedure('employer');

async function employerId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: tables.employers.id })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

async function activeJobIds(db: Database, empId: string): Promise<string[]> {
  const rows = await db
    .select({ id: tables.jobs.id })
    .from(tables.jobs)
    .where(and(eq(tables.jobs.employerId, empId), eq(tables.jobs.status, 'active'), isNull(tables.jobs.deletedAt)));
  return rows.map((r) => r.id);
}

export const employerDashboardRouter = router({
  metrics: emp.query(async ({ ctx }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return { newApplicantsToday: 0, activeJobCount: 0, avgFitScoreThisWeek: null, waPushedToday: 0 };
    const ids = await activeJobIds(ctx.db, empId);
    if (ids.length === 0) return { newApplicantsToday: 0, activeJobCount: 0, avgFitScoreThisWeek: null, waPushedToday: 0 };

    const a = tables.applications;
    const [newApps, avg, wa] = await Promise.all([
      ctx.db
        .select({ c: count() })
        .from(a)
        .where(and(inArray(a.jobId, ids), isNull(a.withdrawnAt), sql`${a.createdAt} >= date_trunc('day', now())`)),
      ctx.db
        .select({ avg: sql<number | null>`round(avg(${a.fitScoreAtApply}))` })
        .from(a)
        .where(and(inArray(a.jobId, ids), isNull(a.withdrawnAt), sql`${a.createdAt} >= now() - interval '7 days'`, sql`${a.fitScoreAtApply} IS NOT NULL`)),
      ctx.db
        .select({ c: count() })
        .from(tables.alertDispatchLog)
        .where(and(inArray(tables.alertDispatchLog.jobId, ids), sql`${tables.alertDispatchLog.dispatchedAt} >= date_trunc('day', now())`)),
    ]);
    return {
      newApplicantsToday: newApps[0]?.c ?? 0,
      activeJobCount: ids.length,
      avgFitScoreThisWeek: avg[0]?.avg ?? null,
      waPushedToday: wa[0]?.c ?? 0,
    };
  }),

  applicants: emp
    .input(
      z.object({
        jobId: z.string().uuid().optional(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const empId = await employerId(ctx.db, ctx.user.id);
      if (!empId) return { items: [], total: 0, jobId: null };

      let jobId = input.jobId;
      if (jobId) {
        const [owned] = await ctx.db
          .select({ id: tables.jobs.id })
          .from(tables.jobs)
          .where(and(eq(tables.jobs.id, jobId), eq(tables.jobs.employerId, empId)))
          .limit(1);
        if (!owned) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });
      } else {
        const [recent] = await ctx.db
          .select({ id: tables.jobs.id })
          .from(tables.jobs)
          .where(and(eq(tables.jobs.employerId, empId), eq(tables.jobs.status, 'active'), isNull(tables.jobs.deletedAt)))
          .orderBy(desc(tables.jobs.publishedAt))
          .limit(1);
        jobId = recent?.id;
      }
      if (!jobId) return { items: [], total: 0, jobId: null };

      const a = tables.applications;
      const conds = [eq(a.jobId, jobId), isNull(a.withdrawnAt), isNull(a.deletedAt)];
      if (input.status) conds.push(eq(a.statusCode, input.status));

      const [items, totalRows] = await Promise.all([
        ctx.db
          .select({
            id: a.id,
            statusCode: a.statusCode,
            fitScoreAtApply: a.fitScoreAtApply,
            createdAt: a.createdAt,
            hasVoiceNote: a.hasVoiceNote,
            questionResponse: a.questionResponse,
            interviewScheduledAt: a.interviewScheduledAt,
            userId: a.seekerUserId,
            fullName: tables.users.nameEn,
            currentDistrict: tables.seekerProfiles.currentDistrict,
            totalExperienceMonths: tables.seekerProfiles.totalExperienceMonths,
            knmcVerified: sql<boolean>`EXISTS (SELECT 1 FROM professional_registrations pr WHERE pr.user_id = ${a.seekerUserId} AND pr.type_code = 'KNMC' AND pr.status_code = 'verified')`,
          })
          .from(a)
          .innerJoin(tables.users, eq(tables.users.id, a.seekerUserId))
          .leftJoin(tables.seekerProfiles, eq(tables.seekerProfiles.userId, a.seekerUserId))
          .where(and(...conds))
          .orderBy(sql`${a.fitScoreAtApply} desc nulls last`, desc(a.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ c: count() }).from(a).where(and(...conds)),
      ]);

      return { items, total: totalRows[0]?.c ?? 0, jobId };
    }),

  jobPosts: emp.query(async ({ ctx }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return [];
    const j = tables.jobs;
    return ctx.db
      .select({
        id: j.id,
        title: j.titleEn,
        slug: j.slug,
        status: j.status,
        district: j.district,
        salaryMinPaise: j.salaryMinPaise,
        salaryDisclosed: j.salaryDisclosed,
        isWalkIn: j.isWalkIn,
        validThrough: j.validThrough,
        viewCount: j.viewCount,
        applicationCount: j.applicationCount,
        shortlistCount: sql<number>`(SELECT count(*)::int FROM applications ap WHERE ap.job_id = jobs.id AND ap.status_code = 'shortlisted' AND ap.withdrawn_at IS NULL)`,
      })
      .from(j)
      .where(and(eq(j.employerId, empId), isNull(j.deletedAt)))
      .orderBy(desc(j.publishedAt), desc(j.createdAt))
      .limit(5);
  }),

  nextWalkIn: emp.query(async ({ ctx }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return null;
    const w = tables.walkInEvents;
    const [ev] = await ctx.db
      .select({
        jobId: w.jobId,
        venueEn: w.venueEn,
        venueMl: w.venueMl,
        startsAt: w.startsAt,
        title: tables.jobs.titleEn,
        titleMl: tables.jobs.titleMl,
        registrations: tables.jobs.applicationCount,
        knmcVerified: sql<number>`(SELECT count(*)::int FROM applications ap JOIN professional_registrations pr ON pr.user_id = ap.seeker_user_id AND pr.type_code = 'KNMC' AND pr.status_code = 'verified' WHERE ap.job_id = ${w.jobId} AND ap.withdrawn_at IS NULL)`,
      })
      .from(w)
      .innerJoin(tables.jobs, eq(tables.jobs.id, w.jobId))
      .where(and(eq(tables.jobs.employerId, empId), isNull(w.deletedAt), sql`${w.startsAt} >= now()`))
      .orderBy(w.startsAt)
      .limit(1);
    return ev ?? null;
  }),

  subscription: emp.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        tier: tables.employers.subscriptionTier,
        jobsPosted: tables.employers.jobsPostedThisPeriod,
        jobsLimit: tables.employers.jobsLimitThisPeriod,
      })
      .from(tables.employers)
      .where(and(eq(tables.employers.ownerUserId, ctx.user.id), isNull(tables.employers.deletedAt)))
      .limit(1);
    const tier = row?.tier ?? 'free';
    // Feature flags by tier (extended when billing lands in D7).
    const features = { talentPoolAccess: false, knmcFilterAccess: false, whatsappPushPerMonth: 0 };
    return { tier, jobsPosted: row?.jobsPosted ?? 0, jobsLimit: row?.jobsLimit ?? 3, features };
  }),

  waPushLog: emp.query(async ({ ctx }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return [];
    const dl = tables.alertDispatchLog;
    return ctx.db
      .select({
        dispatchedAt: dl.dispatchedAt,
        deliveryStatus: dl.deliveryStatus,
        jobId: dl.jobId,
        title: tables.jobs.titleEn,
        batchCount: sql<number>`count(*) over (partition by ${dl.jobId}, date(${dl.dispatchedAt}))::int`,
      })
      .from(dl)
      .innerJoin(tables.jobs, eq(tables.jobs.id, dl.jobId))
      .where(and(eq(tables.jobs.employerId, empId), sql`${dl.dispatchedAt} >= now() - interval '7 days'`))
      .orderBy(desc(dl.dispatchedAt))
      .limit(20);
  }),
});
