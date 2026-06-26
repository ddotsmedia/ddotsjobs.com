import { and, count, desc, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { roleProcedure, router } from '../trpc.js';

const seeker = roleProcedure('seeker');

export const seekerDashboardRouter = router({
  metrics: seeker.query(async ({ ctx }) => {
    const uid = ctx.user.id;
    const [views, apps, avg, alerts] = await Promise.all([
      ctx.db
        .select({ c: count() })
        .from(tables.employerSeekerContacts)
        .where(
          and(
            eq(tables.employerSeekerContacts.seekerUserId, uid),
            sql`${tables.employerSeekerContacts.createdAt} >= now() - interval '7 days'`,
          ),
        ),
      ctx.db
        .select({ c: count() })
        .from(tables.applications)
        .where(and(eq(tables.applications.seekerUserId, uid), isNull(tables.applications.withdrawnAt))),
      ctx.db
        .select({ avg: sql<number | null>`round(avg(${tables.applications.fitScoreAtApply}))` })
        .from(tables.applications)
        .where(
          and(
            eq(tables.applications.seekerUserId, uid),
            isNull(tables.applications.withdrawnAt),
            sql`${tables.applications.fitScoreAtApply} IS NOT NULL`,
          ),
        ),
      ctx.db
        .select({ c: count() })
        .from(tables.alertDispatchLog)
        .where(
          and(
            eq(tables.alertDispatchLog.userId, uid),
            sql`${tables.alertDispatchLog.dispatchedAt} >= now() - interval '1 day'`,
          ),
        ),
    ]);
    return {
      profileViewsThisWeek: views[0]?.c ?? 0,
      applicationsSent: apps[0]?.c ?? 0,
      avgFitScore: avg[0]?.avg ?? null,
      newAlertsToday: alerts[0]?.c ?? 0,
    };
  }),

  recentApplications: seeker.query(async ({ ctx }) => {
    const a = tables.applications;
    return ctx.db
      .select({
        id: a.id,
        statusCode: a.statusCode,
        createdAt: a.createdAt,
        fitScoreAtApply: a.fitScoreAtApply,
        interviewScheduledAt: a.interviewScheduledAt,
        title: tables.jobs.titleEn,
        slug: tables.jobs.slug,
        district: tables.jobs.district,
        salaryMinPaise: tables.jobs.salaryMinPaise,
        salaryDisclosed: tables.jobs.salaryDisclosed,
        company: sql<string>`coalesce(${tables.employers.displayNameEn}, ${tables.employers.legalNameEn})`,
      })
      .from(a)
      .innerJoin(tables.jobs, eq(tables.jobs.id, a.jobId))
      .innerJoin(tables.employers, eq(tables.employers.id, a.employerId))
      .where(and(eq(a.seekerUserId, ctx.user.id), isNull(a.withdrawnAt), isNull(a.deletedAt)))
      .orderBy(desc(a.createdAt))
      .limit(5);
  }),

  recommendedJobs: seeker.query(async ({ ctx }) => {
    const uid = ctx.user.id;
    const j = tables.jobs;
    const e = tables.employers;

    const scored = await ctx.db
      .select({
        id: j.id,
        slug: j.slug,
        title: j.titleEn,
        district: j.district,
        salaryMinPaise: j.salaryMinPaise,
        salaryDisclosed: j.salaryDisclosed,
        company: sql<string>`coalesce(${e.displayNameEn}, ${e.legalNameEn})`,
        overallScore: tables.fitScores.overallScore,
        recommendation: tables.fitScores.recommendation,
      })
      .from(tables.fitScores)
      .innerJoin(j, eq(j.id, tables.fitScores.jobId))
      .innerJoin(e, eq(e.id, j.employerId))
      .where(
        and(
          eq(tables.fitScores.seekerUserId, uid),
          eq(j.status, 'active'),
          isNull(j.deletedAt),
          isNull(tables.fitScores.deletedAt),
          sql`${tables.fitScores.overallScore} IS NOT NULL`,
        ),
      )
      .orderBy(desc(tables.fitScores.overallScore))
      .limit(5);

    if (scored.length > 0) return scored;

    // Fallback: latest jobs in the seeker's home district.
    const [profile] = await ctx.db
      .select({ district: tables.seekerProfiles.homeDistrict })
      .from(tables.seekerProfiles)
      .where(eq(tables.seekerProfiles.userId, uid))
      .limit(1);

    const conds = [eq(j.status, 'active'), isNull(j.deletedAt)];
    if (profile?.district) conds.push(eq(j.district, profile.district));

    const rows = await ctx.db
      .select({
        id: j.id,
        slug: j.slug,
        title: j.titleEn,
        district: j.district,
        salaryMinPaise: j.salaryMinPaise,
        salaryDisclosed: j.salaryDisclosed,
        company: sql<string>`coalesce(${e.displayNameEn}, ${e.legalNameEn})`,
      })
      .from(j)
      .innerJoin(e, eq(e.id, j.employerId))
      .where(and(...conds))
      .orderBy(desc(j.publishedAt))
      .limit(5);
    return rows.map((r) => ({ ...r, overallScore: null as number | null, recommendation: 'apply' as string | null }));
  }),

  recentAlerts: seeker.query(async ({ ctx }) => {
    const dl = tables.alertDispatchLog;
    return ctx.db
      .select({
        dispatchedAt: dl.dispatchedAt,
        deliveryStatus: dl.deliveryStatus,
        title: tables.jobs.titleEn,
        slug: tables.jobs.slug,
        district: tables.jobs.district,
        salaryMinPaise: tables.jobs.salaryMinPaise,
        company: sql<string>`coalesce(${tables.employers.displayNameEn}, ${tables.employers.legalNameEn})`,
      })
      .from(dl)
      .innerJoin(tables.jobs, eq(tables.jobs.id, dl.jobId))
      .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
      .where(eq(dl.userId, ctx.user.id))
      .orderBy(desc(dl.dispatchedAt))
      .limit(5);
  }),

  profileCompletion: seeker.query(async ({ ctx }) => {
    const uid = ctx.user.id;
    const [row] = await ctx.db
      .select({
        pct: tables.seekerProfiles.completionPct,
        totalExperienceMonths: tables.seekerProfiles.totalExperienceMonths,
        salaryMin: tables.seekerProfiles.expectedSalaryMinPaise,
        preferredCategories: tables.seekerProfiles.preferredCategories,
        homeDistrict: tables.seekerProfiles.homeDistrict,
        fullName: tables.users.nameEn,
        primaryProfession: tables.users.primaryProfession,
        isVerifiedProfessional: tables.users.isVerifiedProfessional,
      })
      .from(tables.seekerProfiles)
      .innerJoin(tables.users, eq(tables.users.id, tables.seekerProfiles.userId))
      .where(eq(tables.seekerProfiles.userId, uid))
      .limit(1);

    const [alert] = await ctx.db
      .select({ id: tables.alertSubscriptions.id })
      .from(tables.alertSubscriptions)
      .where(
        and(
          eq(tables.alertSubscriptions.seekerUserId, uid),
          eq(tables.alertSubscriptions.isActive, true),
          isNull(tables.alertSubscriptions.deletedAt),
        ),
      )
      .limit(1);

    const checklist = [
      { item: 'Full name', done: Boolean(row?.fullName), link: '/seeker/profile' },
      { item: 'Primary district', done: Boolean(row?.homeDistrict), link: '/seeker/profile' },
      { item: 'Profession', done: Boolean(row?.primaryProfession), link: '/seeker/profile' },
      { item: 'Experience', done: (row?.totalExperienceMonths ?? 0) > 0, link: '/seeker/profile' },
      { item: 'Salary expectation', done: (row?.salaryMin ?? 0) > 0, link: '/seeker/profile' },
      { item: 'Job preferences', done: (row?.preferredCategories.length ?? 0) > 0, link: '/seeker/profile/setup' },
      { item: 'KNMC/KTET verification', done: Boolean(row?.isVerifiedProfessional), link: '/seeker/profile/verify' },
      { item: 'WhatsApp alerts', done: Boolean(alert), link: '/seeker/alerts' },
    ];
    return { pct: row?.pct ?? 0, checklist };
  }),
});
