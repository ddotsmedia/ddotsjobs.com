import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, isNull, tables, type Database } from '@ddotsjobs/db';
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

type FilterRow = { filterType: string | null; filterValue: string | null };

// Load a subscription owned by the user (or throw), plus its filter rows.
async function loadOwnedSub(db: Database, userId: string, subscriptionId: string) {
  const subs = tables.alertSubscriptions;
  const [sub] = await db
    .select({
      id: subs.id,
      channel: subs.channel,
      language: subs.language,
      frequency: subs.frequencyCode,
      labelEn: subs.labelEn,
    })
    .from(subs)
    .where(and(eq(subs.id, subscriptionId), eq(subs.seekerUserId, userId), isNull(subs.deletedAt)))
    .limit(1);
  if (!sub) throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' });
  const filters: FilterRow[] = await db
    .select({ filterType: tables.alertFilters.filterType, filterValue: tables.alertFilters.filterValue })
    .from(tables.alertFilters)
    .where(eq(tables.alertFilters.subscriptionId, sub.id));
  return { sub, filters };
}

export type AlertMatchJob = {
  id: string;
  slug: string | null;
  title: string;
  company: string;
  district: string | null;
  salaryMinPaise: number | null;
  salaryMaxPaise: number | null;
  salaryDisclosed: boolean;
  publishedAt: Date | null;
};

// Live jobs matching a subscription's stored filters (category+district required,
// job_type/salary/walk-in/gulf optional). Mirrors the worker's match intent.
async function matchingJobs(db: Database, filters: FilterRow[], limit = 20): Promise<AlertMatchJob[]> {
  const vals = (t: string) => filters.filter((f) => f.filterType === t && f.filterValue).map((f) => f.filterValue!);
  const cats = vals('category');
  const dists = vals('district');
  const types = vals('job_type');
  const salaryMin = filters.find((f) => f.filterType === 'salary_min_paise' && f.filterValue)?.filterValue;
  const wantsWalkIn = filters.some((f) => f.filterType === 'is_walk_in');
  const wantsGulf = filters.some((f) => f.filterType === 'values_gulf_experience');

  const j = tables.jobs;
  const conds = [eq(j.status, 'active'), isNull(j.deletedAt)];
  if (cats.length) conds.push(inArray(j.categorySlug, cats));
  if (dists.length) conds.push(inArray(j.district, dists as (typeof j.district.enumValues)[number][]));
  if (types.length) conds.push(inArray(j.type, types as (typeof j.type.enumValues)[number][]));
  if (salaryMin != null) conds.push(gte(j.salaryMinPaise, Number(salaryMin)));
  if (wantsWalkIn) conds.push(eq(j.isWalkIn, true));
  if (wantsGulf) conds.push(eq(j.valuesGulfExperience, true));

  const rows = await db
    .select({
      id: j.id,
      slug: j.slug,
      title: j.titleEn,
      district: j.district,
      salaryMinPaise: j.salaryMinPaise,
      salaryMaxPaise: j.salaryMaxPaise,
      salaryDisclosed: j.salaryDisclosed,
      publishedAt: j.publishedAt,
      displayNameEn: tables.employers.displayNameEn,
      legalNameEn: tables.employers.legalNameEn,
    })
    .from(j)
    .innerJoin(tables.employers, eq(j.employerId, tables.employers.id))
    .where(and(...conds))
    .orderBy(desc(j.publishedAt))
    .limit(limit);

  return rows.map(({ displayNameEn, legalNameEn, ...r }) => ({
    ...r,
    company: displayNameEn ?? legalNameEn ?? 'An employer',
  }));
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

  // Preview: live jobs currently matching an alert's criteria.
  getAlertMatchingJobs: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { filters } = await loadOwnedSub(ctx.db, ctx.user.id, input.subscriptionId);
      const jobs = await matchingJobs(ctx.db, filters);
      return { count: jobs.length, jobs };
    }),

  // Dry-run test: returns what an alert email WOULD contain, without sending.
  // Live delivery is handled by the dispatch worker / digest cron.
  testAlert: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { sub, filters } = await loadOwnedSub(ctx.db, ctx.user.id, input.subscriptionId);
      const jobs = await matchingJobs(ctx.db, filters, 10);
      const label = sub.labelEn ?? 'your job alert';
      return {
        channel: sub.channel,
        frequency: sub.frequency,
        subject: `🔔 ${jobs.length} new job${jobs.length === 1 ? '' : 's'} matching "${label}"`,
        count: jobs.length,
        jobs,
      };
    }),

  deleteAlert: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const subs = tables.alertSubscriptions;
      const res = await ctx.db
        .update(subs)
        .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(subs.id, input.subscriptionId), eq(subs.seekerUserId, ctx.user.id), isNull(subs.deletedAt)))
        .returning({ id: subs.id });
      if (res.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' });
      return { success: true as const };
    }),
});
