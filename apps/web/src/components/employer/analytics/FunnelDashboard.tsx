'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

const TEAL = '#3A9EA5';
const INK = '#0F1A1B';
const STAGE_COLORS = ['#3A9EA5', '#4Fb0A8', '#6FbF9a', '#E0A83B', '#1d7a3a'];
const DAY = 86_400_000;

type RangeKey = '30d' | '90d' | '6m' | 'all';
const RANGES: { key: RangeKey; label: string; days: number | null; gran: 'week' | 'month' }[] = [
  { key: '30d', label: '30 days', days: 30, gran: 'week' },
  { key: '90d', label: '90 days', days: 90, gran: 'week' },
  { key: '6m', label: '6 months', days: 182, gran: 'month' },
  { key: 'all', label: 'All time', days: null, gran: 'month' },
];

export function FunnelDashboard() {
  const [range, setRange] = useState<RangeKey>('90d');
  const [jobId, setJobId] = useState<string>('');
  const [category, setCategory] = useState<string>('');

  const cfg = RANGES.find((r) => r.key === range)!;
  const from = cfg.days ? new Date(Date.now() - cfg.days * DAY).toISOString() : undefined;
  const filters = { from, jobId: jobId || undefined, category: category || undefined };

  const opts = trpc.analytics.getFilterOptions.useQuery();
  const funnel = trpc.analytics.getHiringFunnel.useQuery(filters);
  const tth = trpc.analytics.getTimeToHire.useQuery(filters);
  const sources = trpc.analytics.getApplicantSources.useQuery(filters);
  const stageMx = trpc.analytics.getStageMetrics.useQuery(filters);
  const trends = trpc.analytics.getFunnelTrends.useQuery({ from, granularity: cfg.gran, jobId: jobId || undefined, category: category || undefined });

  const stageDays = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const s of stageMx.data ?? []) m.set(s.stage, s.avgDays);
    return m;
  }, [stageMx.data]);

  const loading = funnel.isLoading;

  return (
    <>
      <header style={s.head}>
        <div>
          <p style={s.eyebrow}>Analytics</p>
          <h1 style={s.h1}>Hiring funnel</h1>
        </div>
        <Link href="/employer/analytics" style={s.back}>← Overview</Link>
      </header>

      <div style={s.filters}>
        <div style={s.segment}>
          {RANGES.map((r) => (
            <button key={r.key} type="button" onClick={() => setRange(r.key)} style={{ ...s.segBtn, ...(range === r.key ? s.segOn : {}) }}>{r.label}</button>
          ))}
        </div>
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={s.select} aria-label="Filter by job">
          <option value="">All jobs</option>
          {(opts.data?.jobs ?? []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={s.select} aria-label="Filter by category">
          <option value="">All categories</option>
          {(opts.data?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={s.muted}>Loading…</p>
      ) : !funnel.data || funnel.data.total === 0 ? (
        <p style={s.muted}>No application data for this filter yet.</p>
      ) : (
        <>
          <div style={s.cards}>
            <MetricCard label="Time to hire" value={fmtDays(tth.data?.avgDaysToHire)} sub={tth.data?.medianDaysToHire != null ? `median ${tth.data.medianDaysToHire}d · ${tth.data.hiredCount} hired` : `${tth.data?.hiredCount ?? 0} hired`} />
            <MetricCard label="Offer acceptance" value={funnel.data.offerAcceptanceRate != null ? `${funnel.data.offerAcceptanceRate}%` : '—'} sub={`${funnel.data.hired} of ${funnel.data.offersSent} offers`} />
            <MetricCard label="Cost per hire" value="—" sub="posting spend not tracked" />
          </div>

          <section style={s.card}>
            <h2 style={s.h2}>Funnel</h2>
            <FunnelChart stages={funnel.data.stages} stageDays={stageDays} />
          </section>

          <div style={s.twoCol}>
            <section style={s.card}>
              <h2 style={s.h2}>Applicant source</h2>
              <SourceBreakdown data={sources.data} />
            </section>
            <section style={s.card}>
              <h2 style={s.h2}>Avg time per stage</h2>
              <StageBars data={stageMx.data ?? []} />
            </section>
          </div>

          <section style={s.card}>
            <h2 style={s.h2}>Applies &amp; hires over time</h2>
            <TrendChart buckets={trends.data?.buckets ?? []} />
          </section>
        </>
      )}
    </>
  );
}

function fmtDays(d: number | null | undefined): string {
  if (d == null) return '—';
  return `${d}d`;
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={s.metric}>
      <div style={s.metricLabel}>{label}</div>
      <div style={s.metricValue}>{value}</div>
      {sub && <div style={s.metricSub}>{sub}</div>}
    </div>
  );
}

type Stage = { key: string; label: string; count: number; conversionPct: number; dropoffCount: number; dropoffPct: number; overallPct: number };

function FunnelChart({ stages, stageDays }: { stages: Stage[]; stageDays: Map<string, number | null> }) {
  const top = stages[0]?.count || 1;
  return (
    <div style={s.funnel}>
      {stages.map((st, i) => {
        const w = Math.max((st.count / top) * 100, 2);
        const avg = stageDays.get(st.key);
        const title = `${st.label}: ${st.count} (${st.overallPct}% of applied)` +
          (i > 0 ? ` · ${st.conversionPct}% from ${stages[i - 1]!.label}, ${st.dropoffCount} dropped (${st.dropoffPct}%)` : '') +
          (avg != null ? ` · avg ${avg}d in stage` : '');
        return (
          <div key={st.key} style={s.funnelRow} title={title}>
            <div style={s.funnelMeta}>
              <span style={s.funnelLabel}>{st.label}</span>
              <span style={s.funnelCount}>{st.count} <span style={s.funnelPct}>· {st.overallPct}%</span></span>
            </div>
            <div style={s.funnelTrack}>
              <div style={{ ...s.funnelBar, width: `${w}%`, background: STAGE_COLORS[i] ?? TEAL }} />
            </div>
            {i > 0 && (
              <div style={s.funnelDrop}>
                {st.conversionPct}% converted{st.dropoffCount > 0 ? ` · ${st.dropoffCount} dropped off` : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SourceBreakdown({ data }: { data: { total: number; sources: { key: string; label: string; count: number }[]; referralApplies: number } | null | undefined }) {
  if (!data || data.total === 0) return <p style={s.muted}>No applies yet.</p>;
  const colors = [TEAL, '#E0A83B'];
  const segs = data.sources.map((sc, i) => ({ ...sc, color: colors[i % colors.length]!, pct: Math.round((sc.count / data.total) * 1000) / 10 }));
  // Donut via conic-gradient.
  let acc = 0;
  const stops = segs.map((sg) => {
    const start = acc;
    acc += sg.pct;
    return `${sg.color} ${start}% ${acc}%`;
  }).join(', ');
  return (
    <div style={s.sourceWrap}>
      <div style={{ ...s.donut, background: `conic-gradient(${stops})` }}>
        <div style={s.donutHole}><span style={s.donutTotal}>{data.total}</span><span style={s.donutTotalLabel}>applies</span></div>
      </div>
      <div style={s.legend}>
        {segs.map((sg) => (
          <div key={sg.key} style={s.legendRow}>
            <span style={{ ...s.dot, background: sg.color }} />
            <span style={s.legendLabel}>{sg.label}</span>
            <span style={s.legendVal}>{sg.count} · {sg.pct}%</span>
          </div>
        ))}
        <div style={s.refNote}>+ {data.referralApplies} referral-attributed applies (tracked separately)</div>
      </div>
    </div>
  );
}

function StageBars({ data }: { data: { stage: string; label: string; avgDays: number | null; n: number }[] }) {
  const max = Math.max(...data.map((d) => d.avgDays ?? 0), 1);
  if (!data.some((d) => d.avgDays != null)) return <p style={s.muted}>Not enough stage transitions yet.</p>;
  return (
    <div style={s.stageBars}>
      {data.map((d) => (
        <div key={d.stage} style={s.stageRow} title={`${d.label}: avg ${d.avgDays ?? '—'}d over ${d.n} moves`}>
          <span style={s.stageName}>{d.label}</span>
          <div style={s.stageTrack}><div style={{ ...s.stageBar, width: `${((d.avgDays ?? 0) / max) * 100}%` }} /></div>
          <span style={s.stageVal}>{d.avgDays != null ? `${d.avgDays}d` : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ buckets }: { buckets: { period: string; applies: number; hired: number }[] }) {
  if (buckets.length < 2) return <p style={s.muted}>Not enough history for a trend yet.</p>;
  const W = 640;
  const H = 180;
  const P = 28;
  const max = Math.max(...buckets.map((b) => b.applies), 1);
  const x = (i: number) => P + (i * (W - 2 * P)) / (buckets.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = (sel: (b: { applies: number; hired: number }) => number) =>
    buckets.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(sel(b)).toFixed(1)}`).join(' ');
  const labelEvery = Math.ceil(buckets.length / 6);
  return (
    <div style={s.trendWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} style={s.trendSvg} role="img" aria-label="Applies and hires over time">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#e2e2da" strokeWidth={1} />
        <path d={line((b) => b.applies)} fill="none" stroke={TEAL} strokeWidth={2.5} />
        <path d={line((b) => b.hired)} fill="none" stroke="#1d7a3a" strokeWidth={2.5} />
        {buckets.map((b, i) => (
          <g key={b.period}>
            <circle cx={x(i)} cy={y(b.applies)} r={2.5} fill={TEAL} />
            {i % labelEvery === 0 && <text x={x(i)} y={H - P + 14} fontSize={9} textAnchor="middle" fill="#8a8a83">{b.period.slice(5)}</text>}
          </g>
        ))}
      </svg>
      <div style={s.legendRowInline}>
        <span style={s.legendRow}><span style={{ ...s.dot, background: TEAL }} /> Applies</span>
        <span style={s.legendRow}><span style={{ ...s.dot, background: '#1d7a3a' }} /> Hires</span>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEAL, margin: 0 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: '2px 0 0', color: 'var(--color-dark)' },
  back: { fontSize: 13, color: '#6b6b66', fontWeight: 600 },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  segment: { display: 'inline-flex', background: '#f1f1ec', borderRadius: 'var(--radius-pill)', padding: 3 },
  segBtn: { border: 'none', background: 'transparent', borderRadius: 'var(--radius-pill)', padding: '7px 12px', fontSize: 13, fontWeight: 600, color: '#6b6b66', cursor: 'pointer' },
  segOn: { background: '#fff', color: INK, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' },
  select: { border: '1px solid #e2e2da', borderRadius: 10, padding: '8px 10px', fontSize: 13, background: '#fff', minHeight: 40, maxWidth: 200 },
  muted: { color: '#8a8a83', fontSize: 14 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-2)' },
  metric: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)' },
  metricLabel: { fontSize: 12, color: '#8a8a83', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  metricValue: { fontSize: 28, fontWeight: 800, color: INK, fontFamily: 'var(--font-display)', margin: '4px 0 2px' },
  metricSub: { fontSize: 12, color: '#8a8a83' },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 10 },
  h2: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'var(--space-2)' },
  funnel: { display: 'flex', flexDirection: 'column', gap: 14 },
  funnelRow: { display: 'flex', flexDirection: 'column', gap: 4 },
  funnelMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  funnelLabel: { fontSize: 14, fontWeight: 700, color: INK },
  funnelCount: { fontSize: 14, fontWeight: 700, color: INK },
  funnelPct: { fontSize: 12, fontWeight: 500, color: '#8a8a83' },
  funnelTrack: { background: '#f4f4ef', borderRadius: 8, height: 26, overflow: 'hidden' },
  funnelBar: { height: '100%', borderRadius: 8, transition: 'width .3s', minWidth: 4 },
  funnelDrop: { fontSize: 12, color: '#8a8a83' },
  sourceWrap: { display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' },
  donut: { width: 120, height: 120, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 },
  donutHole: { width: 76, height: 76, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', textAlign: 'center' },
  donutTotal: { fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1 },
  donutTotalLabel: { fontSize: 10, color: '#8a8a83' },
  legend: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 140 },
  legendRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3a3a34' },
  legendRowInline: { display: 'flex', gap: 16, justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  legendLabel: { flex: 1 },
  legendVal: { fontWeight: 600, color: INK },
  refNote: { fontSize: 12, color: '#8a8a83', marginTop: 4 },
  stageBars: { display: 'flex', flexDirection: 'column', gap: 8 },
  stageRow: { display: 'flex', alignItems: 'center', gap: 10 },
  stageName: { fontSize: 13, color: '#3a3a34', width: 74, flexShrink: 0 },
  stageTrack: { flex: 1, background: '#f4f4ef', borderRadius: 6, height: 18, overflow: 'hidden' },
  stageBar: { height: '100%', background: TEAL, borderRadius: 6, minWidth: 2 },
  stageVal: { fontSize: 13, fontWeight: 600, color: INK, width: 44, textAlign: 'right', flexShrink: 0 },
  trendWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  trendSvg: { width: '100%', height: 'auto' },
};
