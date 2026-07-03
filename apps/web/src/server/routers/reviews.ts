import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { protectedProcedure, publicProcedure, roleProcedure, router } from '../trpc.js';
import { sanitizeHtml } from '@/lib/sanitize';
import { rateLimit } from '../rate-limit.js';

const seekerProc = roleProcedure('seeker');

// Application statuses that prove a real employment relationship.
const VERIFIED_STATUSES = ['interviewed', 'offer_made', 'offer_accepted', 'interview', 'offered', 'hired'];

function logoUrlFor(key: string | null): string | null {
  if (!key) return null;
  return process.env.CLOUDFLARE_R2_ACCOUNT_ID
    ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''}/${key}`
    : `/api/files/${key}`;
}

export const reviewsRouter = router({
  submit: seekerProc
    .input(
      z.object({
        employerId: z.string().uuid(),
        ratingOverall: z.number().int().min(1).max(5),
        ratingWorkCulture: z.number().int().min(1).max(5).optional(),
        ratingWorkLifeBalance: z.number().int().min(1).max(5).optional(),
        ratingPay: z.number().int().min(1).max(5).optional(),
        ratingWomenFriendly: z.number().int().min(1).max(5).optional(),
        reviewText: z.string().min(50).max(2000).optional(),
        reviewTextMl: z.string().max(2000).optional(),
        isAnonymous: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.redis, `review:${ctx.user.id}`, 5, 86_400);
      const cr = tables.companyReviews;

      const [profile] = await ctx.db
        .select({ id: tables.seekerProfiles.id })
        .from(tables.seekerProfiles)
        .where(eq(tables.seekerProfiles.userId, ctx.user.id))
        .limit(1);
      if (!profile) throw new TRPCError({ code: 'FORBIDDEN', message: 'Complete your seeker profile first' });

      const [existing] = await ctx.db
        .select({ id: cr.id })
        .from(cr)
        .where(and(eq(cr.authorUserId, ctx.user.id), eq(cr.employerId, input.employerId), isNull(cr.deletedAt)))
        .limit(1);
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'You already reviewed this company' });

      const [appRow] = await ctx.db
        .select({ id: tables.applications.id })
        .from(tables.applications)
        .innerJoin(tables.jobs, eq(tables.applications.jobId, tables.jobs.id))
        .where(
          and(
            eq(tables.applications.seekerUserId, ctx.user.id),
            eq(tables.jobs.employerId, input.employerId),
            sql`${tables.applications.statusCode} = any(${VERIFIED_STATUSES})`,
          ),
        )
        .limit(1);
      const isVerifiedEmployee = Boolean(appRow);

      const [row] = await ctx.db
        .insert(cr)
        .values({
          authorUserId: ctx.user.id,
          employerId: input.employerId,
          rating: input.ratingOverall,
          ratingWorkCulture: input.ratingWorkCulture ?? null,
          ratingWorkLifeBalance: input.ratingWorkLifeBalance ?? null,
          ratingPay: input.ratingPay ?? null,
          ratingWomenFriendly: input.ratingWomenFriendly ?? null,
          bodyEn: input.reviewText ? sanitizeHtml(input.reviewText) : null,
          bodyMl: input.reviewTextMl ? sanitizeHtml(input.reviewTextMl) : null,
          isAnonymous: input.isAnonymous,
          isVerifiedEmployee,
          status: 'verified',
        })
        .returning({ id: cr.id });

      return { reviewId: row!.id };
    }),

  getForEmployer: publicProcedure
    .input(
      z.object({
        employerSlug: z.string(),
        limit: z.number().int().min(1).max(50).default(10),
        cursor: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const e = tables.employers;
      const cr = tables.companyReviews;

      const [employer] = await ctx.db
        .select({
          id: e.id,
          slug: e.slug,
          name: sql<string>`coalesce(${e.displayNameEn}, ${e.legalNameEn})`,
          nameMl: e.displayNameMl,
          type: sql<string>`coalesce(${e.employerTypeCode}, ${e.type}::text)`,
          district: e.district,
          verified: sql<boolean>`(${e.verificationStatus} = 'verified')`,
          websiteUrl: e.websiteUrl,
          logoR2Key: e.logoR2Key,
        })
        .from(e)
        .where(and(eq(e.slug, input.employerSlug), isNull(e.deletedAt)))
        .limit(1);
      if (!employer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Company not found' });

      const conds = [eq(cr.employerId, employer.id), isNull(cr.deletedAt)];
      if (input.cursor) {
        conds.push(
          sql`(${cr.createdAt}, ${cr.id}) < ((select created_at from company_reviews where id = ${input.cursor}), ${input.cursor}::uuid)`,
        );
      }
      const reviews = await ctx.db
        .select({
          id: cr.id,
          ratingOverall: cr.rating,
          ratingWorkCulture: cr.ratingWorkCulture,
          ratingWorkLifeBalance: cr.ratingWorkLifeBalance,
          ratingPay: cr.ratingPay,
          ratingWomenFriendly: cr.ratingWomenFriendly,
          reviewText: cr.bodyEn,
          reviewTextMl: cr.bodyMl,
          isVerifiedEmployee: cr.isVerifiedEmployee,
          isAnonymous: cr.isAnonymous,
          createdAt: cr.createdAt,
          helpfulCount: cr.helpfulCount,
          reviewerName: sql<string>`case when ${cr.isAnonymous} then 'Anonymous' else coalesce(${tables.users.nameEn}, 'User') end`,
          isMine: ctx.session?.user?.id
            ? sql<boolean>`(${cr.authorUserId} = ${ctx.session.user.id})`
            : sql<boolean>`false`,
        })
        .from(cr)
        .innerJoin(tables.users, eq(tables.users.id, cr.authorUserId))
        .where(and(...conds))
        .orderBy(desc(cr.createdAt), desc(cr.id))
        .limit(input.limit);
      const nextCursor = reviews.length === input.limit ? (reviews[reviews.length - 1]?.id ?? null) : null;

      const [stats] = await ctx.db
        .select({
          total: sql<number>`count(*)::int`,
          avgOverall: sql<number | null>`avg(${cr.rating})`,
          avgCulture: sql<number | null>`avg(${cr.ratingWorkCulture})`,
          avgWlb: sql<number | null>`avg(${cr.ratingWorkLifeBalance})`,
          avgPay: sql<number | null>`avg(${cr.ratingPay})`,
          avgWomen: sql<number | null>`avg(${cr.ratingWomenFriendly})`,
          womenCount: sql<number>`count(${cr.ratingWomenFriendly})::int`,
        })
        .from(cr)
        .where(and(eq(cr.employerId, employer.id), isNull(cr.deletedAt)));

      const womenFriendlyBadge = Number(stats?.avgWomen ?? 0) >= 4 && (stats?.womenCount ?? 0) >= 3;

      const jobs = await ctx.db
        .select({
          id: tables.jobs.id,
          slug: tables.jobs.slug,
          titleEn: tables.jobs.titleEn,
          district: tables.jobs.district,
          salaryMinPaise: tables.jobs.salaryMinPaise,
          salaryDisclosed: tables.jobs.salaryDisclosed,
        })
        .from(tables.jobs)
        .where(and(eq(tables.jobs.employerId, employer.id), eq(tables.jobs.status, 'active'), isNull(tables.jobs.deletedAt)))
        .limit(3);

      return {
        employer: { ...employer, logoUrl: logoUrlFor(employer.logoR2Key) },
        reviews,
        nextCursor,
        stats: {
          total: stats?.total ?? 0,
          avgOverall: stats?.avgOverall != null ? Number(stats.avgOverall) : null,
          avgCulture: stats?.avgCulture != null ? Number(stats.avgCulture) : null,
          avgWlb: stats?.avgWlb != null ? Number(stats.avgWlb) : null,
          avgPay: stats?.avgPay != null ? Number(stats.avgPay) : null,
        },
        womenFriendlyBadge,
        jobs,
      };
    }),

  flag: protectedProcedure
    .input(z.object({ reviewId: z.string().uuid(), reason: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: 'review.flagged',
        entityType: 'company_review',
        entityId: input.reviewId,
        diff: { reason: input.reason },
      });
      return { flagged: true as const };
    }),

  // ── Culture scores (extends the existing company_reviews system) ──────
  breakdown: publicProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const cr = tables.companyReviews;
      const rows = await ctx.db
        .select({ rating: cr.rating, n: sql<number>`count(*)::int` })
        .from(cr)
        .where(and(eq(cr.employerId, input.employerId), isNull(cr.deletedAt)))
        .groupBy(cr.rating);
      const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of rows) {
        const k = r.rating as 1 | 2 | 3 | 4 | 5;
        if (k >= 1 && k <= 5) dist[k] = r.n;
      }
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      return { dist, total };
    }),

  getMyReview: protectedProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const cr = tables.companyReviews;
      const [row] = await ctx.db
        .select({ id: cr.id, rating: cr.rating, bodyEn: cr.bodyEn })
        .from(cr)
        .where(and(eq(cr.employerId, input.employerId), eq(cr.authorUserId, ctx.user.id), isNull(cr.deletedAt)))
        .limit(1);
      return row ?? null;
    }),

  markHelpful: protectedProcedure
    .input(z.object({ reviewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const cr = tables.companyReviews;
      const [row] = await ctx.db
        .update(cr)
        .set({ helpfulCount: sql`${cr.helpfulCount} + 1` })
        .where(and(eq(cr.id, input.reviewId), isNull(cr.deletedAt)))
        .returning({ helpfulCount: cr.helpfulCount });
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return { helpfulCount: row.helpfulCount };
    }),

  deleteReview: protectedProcedure
    .input(z.object({ reviewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const cr = tables.companyReviews;
      const role = ctx.user.role as string;
      const isAdmin = role === 'admin' || role === 'super_admin';
      const res = await ctx.db
        .update(cr)
        .set({ deletedAt: new Date() })
        .where(and(eq(cr.id, input.reviewId), isAdmin ? undefined : eq(cr.authorUserId, ctx.user.id), isNull(cr.deletedAt)))
        .returning({ id: cr.id });
      if (res.length === 0) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed' });
      return { success: true as const };
    }),
});
