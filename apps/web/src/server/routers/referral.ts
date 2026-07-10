import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';
import { rateLimit } from '../rate-limit.js';
import { getSetting } from '@/lib/site-settings';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ddotsjobs.com';
const YEAR_MS = 365 * 86_400_000;

// Balance = SUM(amount) of the ledger. `sumBalance` builds the reusable
// aggregate select so it works on both the db handle and a transaction.
const balanceSelect = { bal: sql<number>`coalesce(sum(${tables.referralCredits.amount}), 0)::int` };

export const referralRouter = router({
  // Create (or fetch) the caller's referral link — generic or job-specific.
  generateReferralLink: protectedProcedure
    .input(z.object({ jobId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.redis, `refshare:${ctx.user.id}`, 100, 86_400);
      const rl = tables.referralLinks;
      const jobId = input.jobId ?? null;

      const [existing] = await ctx.db
        .select({ code: rl.referralCode })
        .from(rl)
        .where(and(eq(rl.userId, ctx.user.id), jobId ? eq(rl.jobId, jobId) : isNull(rl.jobId)))
        .limit(1);

      let code = existing?.code;
      if (!code) {
        code = randomBytes(5).toString('hex'); // 10 chars
        const inserted = await ctx.db
          .insert(rl)
          .values({ userId: ctx.user.id, referralCode: code, jobId, expiresAt: new Date(Date.now() + YEAR_MS) })
          .onConflictDoNothing({ target: [rl.userId, rl.jobId] })
          .returning({ code: rl.referralCode });
        if (!inserted[0]) {
          // Lost a race — re-read the row that won.
          const [row] = await ctx.db
            .select({ code: rl.referralCode })
            .from(rl)
            .where(and(eq(rl.userId, ctx.user.id), jobId ? eq(rl.jobId, jobId) : isNull(rl.jobId)))
            .limit(1);
          code = row?.code ?? code;
        }
      }

      // Build the shareable URL (job slug when job-specific).
      let url = `${APP_URL}/jobs?ref=${code}`;
      if (jobId) {
        const [job] = await ctx.db.select({ slug: tables.jobs.slug }).from(tables.jobs).where(eq(tables.jobs.id, jobId)).limit(1);
        url = `${APP_URL}/jobs/${job?.slug ?? jobId}?ref=${code}`;
      }
      return { code, url };
    }),

  getReferralLinks: protectedProcedure.query(async ({ ctx }) => {
    const rl = tables.referralLinks;
    const rows = await ctx.db
      .select({
        id: rl.id,
        code: rl.referralCode,
        jobId: rl.jobId,
        jobTitle: tables.jobs.titleEn,
        clicks: rl.clickCount,
        applies: rl.applyCount,
        createdAt: rl.createdAt,
      })
      .from(rl)
      .leftJoin(tables.jobs, eq(tables.jobs.id, rl.jobId))
      .where(eq(rl.userId, ctx.user.id))
      .orderBy(desc(rl.createdAt))
      .limit(100);
    return rows;
  }),

  getCreditBalance: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db.select(balanceSelect).from(tables.referralCredits).where(eq(tables.referralCredits.userId, ctx.user.id));
    return { balance: row?.bal ?? 0 };
  }),

  getCreditHistory: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: tables.referralCredits.id,
        transactionType: tables.referralCredits.transactionType,
        amount: tables.referralCredits.amount,
        note: tables.referralCredits.note,
        createdAt: tables.referralCredits.createdAt,
      })
      .from(tables.referralCredits)
      .where(eq(tables.referralCredits.userId, ctx.user.id))
      .orderBy(desc(tables.referralCredits.createdAt))
      .limit(50);
  }),

  // Redeem credits for 1 month of premium. Auto-approved.
  redeemCredits: protectedProcedure
    .input(z.object({ redemptionType: z.enum(['premium_month']) }))
    .mutation(async ({ ctx, input }) => {
      const cost = Number(await getSetting('referral_premium_cost', '500')) || 500;
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx.select(balanceSelect).from(tables.referralCredits).where(eq(tables.referralCredits.userId, ctx.user.id));
        const bal = row?.bal ?? 0;
        if (bal < cost) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Not enough credits. You have ${bal}, need ${cost}.` });
        }
        await tx.insert(tables.referralCredits).values({ userId: ctx.user.id, transactionType: 'redeem', amount: -cost, note: input.redemptionType });
        await tx
          .update(tables.users)
          .set({ premiumUntil: sql`greatest(coalesce(${tables.users.premiumUntil}, now()), now()) + interval '1 month'`, premiumSource: 'credits' })
          .where(eq(tables.users.id, ctx.user.id));
        await tx.insert(tables.referralRedemptions).values({ userId: ctx.user.id, redemptionType: input.redemptionType, creditsUsed: cost, status: 'redeemed', approvedAt: new Date() });
        return { ok: true as const, newBalance: bal - cost };
      });
    }),

  getPremiumStatus: protectedProcedure.query(async ({ ctx }) => {
    const [u] = await ctx.db
      .select({ premiumUntil: tables.users.premiumUntil, premiumSource: tables.users.premiumSource })
      .from(tables.users)
      .where(eq(tables.users.id, ctx.user.id))
      .limit(1);
    const active = Boolean(u?.premiumUntil && new Date(u.premiumUntil) > new Date());
    const cost = Number(await getSetting('referral_premium_cost', '500')) || 500;
    return { active, premiumUntil: u?.premiumUntil ?? null, source: u?.premiumSource ?? null, premiumCost: cost };
  }),

  // Public: count a click when someone opens a ?ref link. Best-effort.
  trackClick: publicProcedure
    .input(z.object({ referralCode: z.string().max(20) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .update(tables.referralLinks)
          .set({ clickCount: sql`${tables.referralLinks.clickCount} + 1` })
          .where(eq(tables.referralLinks.referralCode, input.referralCode));
      } catch {
        /* best-effort */
      }
      return { ok: true as const };
    }),
});
