import { z } from 'zod';
import { and, eq, isNull, tables, type Database } from '@ddotsjobs/db';
import { protectedProcedure, roleProcedure, router } from '../trpc.js';

const DISTRICTS = [
  'thiruvananthapuram', 'kollam', 'pathanamthitta', 'alappuzha', 'kottayam',
  'idukki', 'ernakulam', 'thrissur', 'palakkad', 'malappuram', 'kozhikode',
  'wayanad', 'kannur', 'kasaragod',
] as const;

const FREQ_ENUM: Record<string, 'instant' | 'daily' | 'weekly'> = {
  immediate: 'instant',
  daily_digest: 'daily',
  weekly: 'weekly',
};

const subscribeInput = z.object({
  channel: z.enum(['whatsapp', 'email']).default('whatsapp'),
  language: z.enum(['ml', 'en']).default('ml'),
  frequency: z.enum(['immediate', 'daily_digest', 'weekly']).default('immediate'),
  categories: z.array(z.string().max(60)).min(1),
  districts: z.array(z.enum(DISTRICTS)).min(1),
  salaryMinPaise: z.number().int().nonnegative().optional(),
  jobTypes: z.array(z.string().max(40)).optional(),
  isWalkIn: z.boolean().optional(),
  valuesGulfExperience: z.boolean().optional(),
});
type SubscribeInput = z.infer<typeof subscribeInput>;

async function applySubscription(db: Database, userId: string, input: SubscribeInput) {
  const subs = tables.alertSubscriptions;
  const [sub] = await db
    .insert(subs)
    .values({
      seekerUserId: userId,
      channel: input.channel,
      language: input.language,
      frequencyCode: input.frequency,
      frequency: FREQ_ENUM[input.frequency],
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [subs.seekerUserId, subs.channel],
      targetWhere: isNull(subs.deletedAt),
      set: {
        language: input.language,
        frequencyCode: input.frequency,
        frequency: FREQ_ENUM[input.frequency],
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning({ id: subs.id });

  const subscriptionId = sub!.id;

  // Replace all filters.
  await db.delete(tables.alertFilters).where(eq(tables.alertFilters.subscriptionId, subscriptionId));

  const rows: {
    subscriptionId: string;
    field: string;
    value: unknown;
    filterType: string;
    filterValue: string;
  }[] = [];
  const push = (filterType: string, filterValue: string) =>
    rows.push({ subscriptionId, field: filterType, value: filterValue, filterType, filterValue });

  for (const c of input.categories) push('category', c);
  for (const d of input.districts) push('district', d);
  for (const t of input.jobTypes ?? []) push('job_type', t);
  if (input.salaryMinPaise != null) push('salary_min_paise', String(input.salaryMinPaise));
  if (input.isWalkIn) push('is_walk_in', 'true');
  if (input.valuesGulfExperience) push('values_gulf_experience', 'true');

  if (rows.length > 0) await db.insert(tables.alertFilters).values(rows);

  return { subscriptionId, filterCount: rows.length };
}

export const alertsRouter = router({
  subscribe: roleProcedure('seeker')
    .input(subscribeInput)
    .mutation(({ ctx, input }) => applySubscription(ctx.db, ctx.user.id, input)),

  updateFilters: roleProcedure('seeker')
    .input(subscribeInput)
    .mutation(({ ctx, input }) => applySubscription(ctx.db, ctx.user.id, input)),

  unsubscribe: protectedProcedure
    .input(
      z.object({
        channel: z.enum(['whatsapp', 'email']).optional(),
        category: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const subs = tables.alertSubscriptions;
      if (input.category) {
        const [sub] = await ctx.db
          .select({ id: subs.id })
          .from(subs)
          .where(
            and(
              eq(subs.seekerUserId, ctx.user.id),
              eq(subs.channel, input.channel ?? 'whatsapp'),
              isNull(subs.deletedAt),
            ),
          )
          .limit(1);
        if (sub) {
          await ctx.db
            .delete(tables.alertFilters)
            .where(
              and(
                eq(tables.alertFilters.subscriptionId, sub.id),
                eq(tables.alertFilters.filterType, 'category'),
                eq(tables.alertFilters.filterValue, input.category),
              ),
            );
        }
        return { success: true as const };
      }

      await ctx.db
        .update(subs)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(subs.seekerUserId, ctx.user.id),
            eq(subs.channel, input.channel ?? 'whatsapp'),
            isNull(subs.deletedAt),
          ),
        );
      return { success: true as const };
    }),

  mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
    const subs = await ctx.db
      .select({
        id: tables.alertSubscriptions.id,
        channel: tables.alertSubscriptions.channel,
        language: tables.alertSubscriptions.language,
        frequency: tables.alertSubscriptions.frequencyCode,
        isActive: tables.alertSubscriptions.isActive,
        totalSent: tables.alertSubscriptions.totalSent,
      })
      .from(tables.alertSubscriptions)
      .where(
        and(
          eq(tables.alertSubscriptions.seekerUserId, ctx.user.id),
          isNull(tables.alertSubscriptions.deletedAt),
        ),
      );

    const result = [];
    for (const sub of subs) {
      const filters = await ctx.db
        .select({ filterType: tables.alertFilters.filterType, filterValue: tables.alertFilters.filterValue })
        .from(tables.alertFilters)
        .where(eq(tables.alertFilters.subscriptionId, sub.id));
      result.push({ ...sub, filters });
    }
    return result;
  }),
});
