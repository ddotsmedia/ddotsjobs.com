import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, count, createNotification, desc, eq, sql, tables, type Database } from '@ddotsjobs/db';
import { protectedProcedure, publicProcedure, roleProcedure, router } from '../trpc.js';
import { rateLimit } from '../rate-limit.js';
import { enqueueEmail } from '../queue.js';
import { cached, TTL } from '@/lib/cache';

const seekerProc = roleProcedure('seeker');

// Recompute the denormalized count for (endorsee, skill) from source rows and
// upsert the summary. Recompute (not +/-1) avoids drift. Returns current count.
async function refreshSummary(db: Database, endorseeId: string, skillName: string): Promise<number> {
  const se = tables.skillEndorsements;
  const [c] = await db
    .select({ n: count() })
    .from(se)
    .where(and(eq(se.endorseeId, endorseeId), eq(se.skillName, skillName)));
  const n = c?.n ?? 0;
  const uss = tables.userSkillSummary;
  await db
    .insert(uss)
    .values({ userId: endorseeId, skillName, endorsementCount: n, lastEndorsedAt: n > 0 ? new Date() : null })
    .onConflictDoUpdate({
      target: [uss.userId, uss.skillName],
      set: { endorsementCount: n, lastEndorsedAt: n > 0 ? new Date() : sql`${uss.lastEndorsedAt}` },
    });
  return n;
}

// The endorsee must actually list this skill on their seeker profile.
async function assertEndorseeHasSkill(db: Database, endorseeId: string, skillName: string): Promise<void> {
  const [row] = await db
    .select({ skills: tables.seekerProfiles.skills })
    .from(tables.seekerProfiles)
    .where(eq(tables.seekerProfiles.userId, endorseeId))
    .limit(1);
  if (!row || !row.skills.includes(skillName)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'That skill is not on this profile' });
  }
}

export const endorsementRouter = router({
  // Endorse a peer's skill. Idempotent per (endorser, endorsee, skill).
  endorseSkill: seekerProc
    .input(z.object({ userId: z.string().uuid(), skillName: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot endorse yourself' });
      }
      await rateLimit(ctx.redis, `endorsement:${ctx.user.id}`, 5, 86_400);
      await assertEndorseeHasSkill(ctx.db, input.userId, input.skillName);

      const se = tables.skillEndorsements;
      const inserted = await ctx.db
        .insert(se)
        .values({ endorserId: ctx.user.id, endorseeId: input.userId, skillName: input.skillName })
        .onConflictDoNothing({ target: [se.endorserId, se.endorseeId, se.skillName] })
        .returning({ id: se.id });

      const currentCount = await refreshSummary(ctx.db, input.userId, input.skillName);

      // Notify only on a genuinely new endorsement.
      if (inserted.length > 0) {
        const [me] = await ctx.db
          .select({ name: tables.users.nameEn })
          .from(tables.users)
          .where(eq(tables.users.id, ctx.user.id))
          .limit(1);
        const who = me?.name ?? 'Someone';
        await createNotification({
          userId: input.userId,
          type: 'skill.endorsed',
          title: `${who} endorsed you for ${input.skillName}`,
          titleMl: `${who} നിങ്ങളെ ${input.skillName}-ന് അംഗീകരിച്ചു`,
          body: `You now have ${currentCount} endorsement${currentCount === 1 ? '' : 's'} for ${input.skillName}.`,
          actionUrl: '/seeker/profile',
        }).catch(() => {
          /* notification is best-effort */
        });
        await enqueueEmail({
          eventType: 'endorsement',
          userId: input.userId,
          context: { endorserName: who, skillName: input.skillName, count: currentCount },
        });
      }
      return { endorsed: true as const, count: currentCount };
    }),

  // Remove your endorsement of a peer's skill.
  revokeEndorsement: seekerProc
    .input(z.object({ userId: z.string().uuid(), skillName: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const se = tables.skillEndorsements;
      await ctx.db
        .delete(se)
        .where(and(eq(se.endorserId, ctx.user.id), eq(se.endorseeId, input.userId), eq(se.skillName, input.skillName)));
      const currentCount = await refreshSummary(ctx.db, input.userId, input.skillName);
      return { endorsed: false as const, count: currentCount };
    }),

  // Skills + counts for a profile view (public). Sorted by count desc.
  getUserSkillEndorsements: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const uss = tables.userSkillSummary;
      return ctx.db
        .select({
          skillName: uss.skillName,
          count: uss.endorsementCount,
          lastEndorsedAt: uss.lastEndorsedAt,
        })
        .from(uss)
        .where(and(eq(uss.userId, input.userId), sql`${uss.endorsementCount} > 0`))
        .orderBy(desc(uss.endorsementCount), desc(uss.lastEndorsedAt));
    }),

  // Has the caller already endorsed this (user, skill)? For button state.
  hasUserEndorsedSkill: protectedProcedure
    .input(z.object({ userId: z.string().uuid(), skillName: z.string().trim().min(1).max(80) }))
    .query(async ({ ctx, input }) => {
      const se = tables.skillEndorsements;
      const [row] = await ctx.db
        .select({ id: se.id })
        .from(se)
        .where(and(eq(se.endorserId, ctx.user.id), eq(se.endorseeId, input.userId), eq(se.skillName, input.skillName)))
        .limit(1);
      return { endorsed: Boolean(row) };
    }),

  // Which skills the caller has already endorsed for a given user (button state
  // for the whole profile in one call).
  myEndorsementsFor: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const se = tables.skillEndorsements;
      const rows = await ctx.db
        .select({ skillName: se.skillName })
        .from(se)
        .where(and(eq(se.endorserId, ctx.user.id), eq(se.endorseeId, input.userId)));
      return rows.map((r) => r.skillName);
    }),

  // Top endorsed skills across the platform (leaderboard). Cached 6h — heavy
  // platform-wide aggregate, eventual consistency is fine.
  getTopSkills: publicProcedure.query(async ({ ctx }) => {
    const uss = tables.userSkillSummary;
    return cached('leaderboard', 'top-skills', TTL.referralLeaderboard, () =>
      ctx.db
        .select({
          skillName: uss.skillName,
          totalEndorsements: sql<number>`sum(${uss.endorsementCount})::int`,
          userCount: count(),
        })
        .from(uss)
        .where(sql`${uss.endorsementCount} > 0`)
        .groupBy(uss.skillName)
        .orderBy(desc(sql`sum(${uss.endorsementCount})`))
        .limit(10),
    );
  }),
});
