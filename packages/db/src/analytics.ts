import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import * as tables from './schema/index.js';

// Shared hiring-analytics compute — used by the employer analytics router (web)
// and the scheduled-report worker (worker). Pure functions over a bounded fetch;
// the funnel "reach" is derived from statusHistory (an applicant who reached a
// stage counts toward every earlier stage), not just the current stage column.

export const FUNNEL = ['applied', 'screening', 'interview', 'offer', 'hired'] as const;
export type FunnelStage = (typeof FUNNEL)[number];
export const FUNNEL_LABEL: Record<FunnelStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
};
const RANK: Record<string, number> = { applied: 0, screening: 1, interview: 2, offer: 3, hired: 4 };
const DAY_MS = 86_400_000;

export interface ReportFilters {
  jobId?: string;
  from?: string;
  to?: string;
  category?: string;
}

export interface AnalyticsAppRow {
  id: string;
  jobId: string;
  stage: string;
  statusHistory: { status: string; at: string }[];
  createdAt: Date;
  stagedAt: Date | null;
  appliedVia: string;
  withdrawnAt: Date | null;
  jobCreatedAt: Date;
}

export async function resolveEmployerId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: tables.employers.id })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

export async function fetchApplicationsForReport(db: Database, empId: string, f: ReportFilters): Promise<AnalyticsAppRow[]> {
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

function maxRank(r: AnalyticsAppRow): number {
  let rank = 0;
  const bump = (s: string) => {
    const v = RANK[s];
    if (v !== undefined && v > rank) rank = v;
  };
  bump(r.stage);
  for (const h of r.statusHistory ?? []) bump(h.status);
  return rank;
}

function hiredAt(r: AnalyticsAppRow): Date | null {
  const entries = (r.statusHistory ?? []).filter((h) => h.status === 'hired');
  if (entries.length) return new Date(entries[entries.length - 1]!.at);
  if (r.stage === 'hired') return r.stagedAt ?? null;
  return null;
}

export interface FunnelStageRow {
  key: FunnelStage;
  label: string;
  count: number;
  conversionPct: number;
  dropoffCount: number;
  dropoffPct: number;
  overallPct: number;
}

export function computeFunnel(rows: AnalyticsAppRow[]) {
  const counts = FUNNEL.map((s) => rows.filter((r) => maxRank(r) >= RANK[s]!).length);
  const top = counts[0]!;
  const stages: FunnelStageRow[] = FUNNEL.map((key, i) => {
    const count = counts[i]!;
    const prev = i === 0 ? count : counts[i - 1]!;
    const conversionPct = prev > 0 ? Math.round((count / prev) * 1000) / 10 : 0;
    const dropoffCount = i === 0 ? 0 : prev - count;
    const dropoffPct = i === 0 || prev === 0 ? 0 : Math.round((dropoffCount / prev) * 1000) / 10;
    const overallPct = top > 0 ? Math.round((count / top) * 1000) / 10 : 0;
    return { key, label: FUNNEL_LABEL[key], count, conversionPct, dropoffCount, dropoffPct, overallPct };
  });
  const offers = counts[RANK.offer!]!;
  const hired = counts[RANK.hired!]!;
  return {
    total: top,
    stages,
    offersSent: offers,
    hired,
    offerAcceptanceRate: offers > 0 ? Math.round((hired / offers) * 1000) / 10 : null,
    costPerHire: null as number | null,
  };
}

export function computeTimeToHire(rows: AnalyticsAppRow[]) {
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
  return { hiredCount: applied.length, avgDaysToHire: avg(applied), medianDaysToHire: median(applied), avgDaysFromPost: avg(fromPost) };
}

export function computeSources(rows: AnalyticsAppRow[]) {
  let quickApply = 0;
  let direct = 0;
  for (const r of rows) {
    if (r.appliedVia === 'quick_apply') quickApply += 1;
    else direct += 1;
  }
  return {
    total: rows.length,
    sources: [
      { key: 'direct', label: 'Direct (web)', count: direct },
      { key: 'quick_apply', label: 'Quick apply', count: quickApply },
    ],
  };
}

export async function fetchReferralApplies(db: Database, empId: string): Promise<number> {
  const [ref] = await db
    .select({ applies: sql<number>`coalesce(sum(${tables.referralLinks.applyCount}), 0)::int` })
    .from(tables.referralLinks)
    .innerJoin(tables.jobs, eq(tables.jobs.id, tables.referralLinks.jobId))
    .where(eq(tables.jobs.employerId, empId));
  return ref?.applies ?? 0;
}

export function computeStageMetrics(rows: AnalyticsAppRow[]) {
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
    label: FUNNEL_LABEL[s],
    avgDays: n[s] ? Math.round((sum[s]! / n[s]!) * 10) / 10 : null,
    n: n[s] ?? 0,
  }));
}
