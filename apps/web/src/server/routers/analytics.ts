import { z } from 'zod';
import { and, desc, eq, gte, isNull, lte, sql, tables, type Database } from '@ddotsjobs/db';
import { roleProcedure, router } from '../trpc.js';

const emp = roleProcedure('employer');

// Funnel reach order. rejected / withdrawn are exits, not steps.
const FUNNEL = ['applied', 'screening', 'interview', 'offer', 'hired'] as const;
type FunnelStage = (typeof FUNNEL)[number];
const RANK: Record<string, number> = { applied: 0, screening: 1, interview: 2, offer: 3, hired: 4 };
const LABEL: Record<FunnelStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
};
const DAY_MS = 86_400_000;

const filters = z
  .object({
    jobId: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    category: z.string().max(100).optional(),
  })
  .optional();
type Filters = NonNullable<z.infer<typeof filters>>;

async function employerId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: tables.employers.id })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

type AppRow = {
  id: string;
  jobId: string;
  stage: string;
  statusHistory: { status: string; at: string }[];
  createdAt: Date;
  stagedAt: Date | null;
  appliedVia: string;
  withdrawnAt: Date | null;
  jobCreatedAt: Date;
};

// Bounded fetch of an employer's applications, joined to their jobs for scoping + filters.
async function fetchApps(db: Database, empId: string, f: Filters): Promise<AppRow[]> {
  const a = tables.applications;
  const j = tables.jobs;
  const conds = [eq(j.employerId, empId), isNull(a.deletedAt)];
  if (f.jobId) conds.push(eq(a.jobId, f.jobId));
  if (f.from) conds.push(gte(a.createdAt, new Date(f.from)));
  if (f.to) conds.push(lte(a.createdAt, new Date(f.to)));
  if (f.category) conds.push(eq(j.categorySlug, f.category));
  return db
    .select({
      id: a.id,
      jobId: a.jobId,
      stage: a.stage,
      statusHistory: a.statusHistory,
      createdAt: a.createdAt,
      stagedAt: a.stagedAt,
      appliedVia: a.appliedVia,
      withdrawnAt: a.withdrawnAt,
      jobCreatedAt: j.createdAt,
    })
    .from(a)
    .innerJoin(j, eq(j.id, a.jobId))
    .where(and(...conds))
    .limit(8000);
}

// Highest funnel stage an application has ever reached (current stage ∪ history).
function maxRank(r: AppRow): number {
  let rank = 0;
  const bump = (s: string) => {
    const v = RANK[s];
    if (v !== undefined && v > rank) rank = v;
  };
  bump(r.stage);
  for (const h of r.statusHistory ?? []) bump(h.status);
  return rank;
}

// Timestamp an application was hired, or null if never.
function hiredAt(r: AppRow): Date | null {
  const entries = (r.statusHistory ?? []).filter((h) => h.status === 'hired');
  if (entries.length) return new Date(entries[entries.length - 1]!.at);
  if (r.stage === 'hired') return r.stagedAt ?? null;
  return null;
}

function toFilters(input: z.infer<typeof filters>): Filters {
  return input ?? {};
}

export const analyticsRouter = router({
  // Funnel: applied → screening → interview → offer → hired, with conversion + drop-off.
  getHiringFunnel: emp.input(filters).query(async ({ ctx, input }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return null;
    const rows = await fetchApps(ctx.db, empId, toFilters(input));

    const counts = FUNNEL.map((s) => rows.filter((r) => maxRank(r) >= RANK[s]!).length);
    const top = counts[0]!;
    const stages = FUNNEL.map((key, i) => {
      const count = counts[i]!;
      const prev = i === 0 ? count : counts[i - 1]!;
      const conversionPct = prev > 0 ? Math.round((count / prev) * 1000) / 10 : 0;
      const dropoffCount = i === 0 ? 0 : prev - count;
      const dropoffPct = i === 0 || prev === 0 ? 0 : Math.round((dropoffCount / prev) * 1000) / 10;
      const overallPct = top > 0 ? Math.round((count / top) * 1000) / 10 : 0;
      return { key, label: LABEL[key], count, conversionPct, dropoffCount, dropoffPct, overallPct };
    });

    const offers = counts[RANK.offer!]!;
    const hired = counts[RANK.hired!]!;
    const offerAcceptanceRate = offers > 0 ? Math.round((hired / offers) * 1000) / 10 : null;

    return {
      total: top,
      stages,
      offerAcceptanceRate,
      offersSent: offers,
      hired,
      // Cost-per-hire needs tracked posting spend, which is not recorded — surfaced as null.
      costPerHire: null as number | null,
    };
  }),

  // Average days from application (and from job posting) to hire.
  getTimeToHire: emp.input(filters).query(async ({ ctx, input }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return null;
    const rows = await fetchApps(ctx.db, empId, toFilters(input));

    const applied: number[] = [];
    const fromPost: number[] = [];
    for (const r of rows) {
      const h = hiredAt(r);
      if (!h) continue;
      applied.push((h.getTime() - r.createdAt.getTime()) / DAY_MS);
      fromPost.push((h.getTime() - r.jobCreatedAt.getTime()) / DAY_MS);
    }
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
    const median = (xs: number[]) => {
      if (!xs.length) return null;
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return Math.round((s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2) * 10) / 10;
    };
    return {
      hiredCount: applied.length,
      avgDaysToHire: avg(applied),
      medianDaysToHire: median(applied),
      avgDaysFromPost: avg(fromPost),
    };
  }),

  // Source / channel breakdown. Per-application source is appliedVia; referral is tracked
  // separately on referral_links (attribution overlaps channels, so surfaced alongside).
  getApplicantSources: emp.input(filters).query(async ({ ctx, input }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return null;
    const rows = await fetchApps(ctx.db, empId, toFilters(input));

    let quickApply = 0;
    let direct = 0;
    for (const r of rows) {
      if (r.appliedVia === 'quick_apply') quickApply += 1;
      else direct += 1;
    }
    const total = rows.length;

    // Referral-attributed applies across this employer's jobs.
    const [ref] = await ctx.db
      .select({ applies: sql<number>`coalesce(sum(${tables.referralLinks.applyCount}), 0)::int` })
      .from(tables.referralLinks)
      .innerJoin(tables.jobs, eq(tables.jobs.id, tables.referralLinks.jobId))
      .where(eq(tables.jobs.employerId, empId));

    return {
      total,
      sources: [
        { key: 'direct', label: 'Direct (web)', count: direct },
        { key: 'quick_apply', label: 'Quick apply', count: quickApply },
      ],
      referralApplies: ref?.applies ?? 0,
    };
  }),

  // Average time spent in each stage (completed transitions only).
  getStageMetrics: emp.input(filters).query(async ({ ctx, input }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return null;
    const rows = await fetchApps(ctx.db, empId, toFilters(input));

    const sum: Record<string, number> = {};
    const n: Record<string, number> = {};
    for (const r of rows) {
      const hist = [...(r.statusHistory ?? [])].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      for (let i = 0; i < hist.length - 1; i += 1) {
        const stage = hist[i]!.status;
        if (RANK[stage] === undefined) continue;
        const days = (new Date(hist[i + 1]!.at).getTime() - new Date(hist[i]!.at).getTime()) / DAY_MS;
        if (days < 0) continue;
        sum[stage] = (sum[stage] ?? 0) + days;
        n[stage] = (n[stage] ?? 0) + 1;
      }
    }
    return FUNNEL.filter((s) => s !== 'hired').map((s) => ({
      stage: s,
      label: LABEL[s],
      avgDays: n[s] ? Math.round((sum[s]! / n[s]!) * 10) / 10 : null,
      n: n[s] ?? 0,
    }));
  }),

  // Applies + hires bucketed weekly/monthly over a date range (default last 90 days).
  getFunnelTrends: emp
    .input(
      z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        granularity: z.enum(['week', 'month']).default('week'),
        jobId: z.string().uuid().optional(),
        category: z.string().max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const empId = await employerId(ctx.db, ctx.user.id);
      if (!empId) return { granularity: input.granularity, buckets: [] as { period: string; applies: number; hired: number }[] };

      const to = input.to ? new Date(input.to) : new Date();
      const from = input.from ? new Date(input.from) : new Date(to.getTime() - 90 * DAY_MS);
      const rows = await fetchApps(ctx.db, empId, { from: from.toISOString(), to: to.toISOString(), jobId: input.jobId, category: input.category });

      // Bucket key: ISO week-start (Mon) or month-start, as YYYY-MM-DD.
      const keyOf = (d: Date): string => {
        const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), input.granularity === 'month' ? 1 : d.getUTCDate()));
        if (input.granularity === 'week') {
          const dow = (t.getUTCDay() + 6) % 7; // 0 = Monday
          t.setUTCDate(t.getUTCDate() - dow);
        }
        return t.toISOString().slice(0, 10);
      };

      const buckets = new Map<string, { applies: number; hired: number }>();
      // Pre-seed empty buckets across the range so the trend line has no gaps.
      const step = input.granularity === 'month' ? null : 7 * DAY_MS;
      if (step) {
        for (let t = new Date(keyOf(from) + 'T00:00:00Z').getTime(); t <= to.getTime(); t += step) {
          buckets.set(keyOf(new Date(t)), { applies: 0, hired: 0 });
        }
      } else {
        const c = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
        while (c.getTime() <= to.getTime()) {
          buckets.set(keyOf(c), { applies: 0, hired: 0 });
          c.setUTCMonth(c.getUTCMonth() + 1);
        }
      }
      const ensure = (k: string) => {
        let b = buckets.get(k);
        if (!b) buckets.set(k, (b = { applies: 0, hired: 0 }));
        return b;
      };

      for (const r of rows) {
        ensure(keyOf(r.createdAt)).applies += 1;
        const h = hiredAt(r);
        if (h && h >= from && h <= to) ensure(keyOf(h)).hired += 1;
      }

      const out = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, v]) => ({ period, ...v }));
      return { granularity: input.granularity, buckets: out };
    }),

  // Job list + category set for the filter controls.
  getFilterOptions: emp.query(async ({ ctx }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return { jobs: [], categories: [] };
    const jobs = await ctx.db
      .select({ id: tables.jobs.id, title: tables.jobs.titleEn, category: tables.jobs.categorySlug })
      .from(tables.jobs)
      .where(and(eq(tables.jobs.employerId, empId), isNull(tables.jobs.deletedAt)))
      .orderBy(desc(tables.jobs.createdAt))
      .limit(300);
    const categories = [...new Set(jobs.map((j) => j.category).filter((c): c is string => Boolean(c)))].sort();
    return { jobs: jobs.map((j) => ({ id: j.id, title: j.title })), categories };
  }),
});
