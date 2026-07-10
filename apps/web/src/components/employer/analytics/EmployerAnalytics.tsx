'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { titleCase } from '@/lib/format';

type Range = '7d' | '30d' | 'all';
const RANGES: { key: Range; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

const TEAL = '#3A9EA5';
const YELLOW = '#F5C842';
const ORANGE = '#E8623A';

const STATUS_COLOR: Record<string, string> = {
  active: '#1d7a3a',
  pending_review: '#9a6b00',
  paused: '#9a6b00',
  filled: '#6b6b66',
  expired: '#c0392b',
  closed: '#6b6b66',
  rejected: '#c0392b',
  draft: '#6b6b66',
};

export function EmployerAnalytics() {
  const [range, setRange] = useState<Range>('7d');
  const q = trpc.employer.getAnalyticsDashboard.useQuery({ range });
  const utils = trpc.useUtils();
  const d = q.data;

  const kpis = d?.kpis;
  const cards = [
    { label: 'Total Views', value: kpis?.totalViews ?? 0, color: TEAL },
    { label: 'Total Applications', value: kpis?.totalApplications ?? 0, color: ORANGE },
    { label: 'Conversion Rate', value: kpis ? `${kpis.conversionRate}%` : '0%', color: YELLOW },
    { label: 'Active Jobs', value: kpis?.activeJobs ?? 0, color: TEAL },
  ];

  // Merge views + applications into a single daily timeline.
  const timeline = useMemo(() => {
    const map = new Map<string, { date: string; views: number; applies: number }>();
    for (const r of d?.viewsByDate ?? []) map.set(r.date, { date: r.date, views: r.count, applies: 0 });
    for (const r of d?.applicationsByDate ?? []) {
      const e = map.get(r.date) ?? { date: r.date, views: 0, applies: 0 };
      e.applies = r.count;
      map.set(r.date, e);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [d]);

  return (
    <>
      <header style={s.head}>
        <div>
          <h1 style={s.h1}>Analytics</h1>
          <p style={s.sub}>Views, applications and conversion across your jobs.</p>
        </div>
        <div style={s.rangeRow}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              style={{ ...s.rangeBtn, ...(range === r.key ? s.rangeActive : {}) }}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void utils.employer.getAnalyticsDashboard.invalidate()}
            style={s.refresh}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </header>

      {q.isLoading ? (
        <p style={s.muted}>Loading analytics…</p>
      ) : q.isError ? (
        <p style={s.err}>Couldn’t load analytics. {q.error.data?.code === 'NOT_FOUND' ? 'No employer account found.' : 'Please try again.'}</p>
      ) : (
        <>
          {/* KPI cards */}
          <section style={s.kpiGrid}>
            {cards.map((c) => (
              <div key={c.label} style={s.kpiCard}>
                <span style={{ ...s.kpiValue, color: c.color }}>
                  {typeof c.value === 'number' ? c.value.toLocaleString('en-IN') : c.value}
                </span>
                <span style={s.kpiLabel}>{c.label}</span>
              </div>
            ))}
          </section>

          {/* Timeline */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <h2 style={s.cardTitle}>Views & Applications (last 30 days)</h2>
              <div style={s.legend}>
                <span><i style={{ ...s.dot, background: TEAL }} /> Views</span>
                <span><i style={{ ...s.dot, background: ORANGE }} /> Applications</span>
              </div>
            </div>
            <GroupedTimeline data={timeline} />
          </section>

          {/* Top performing jobs */}
          <section style={s.card}>
            <h2 style={s.cardTitle}>Top performing jobs</h2>
            {(d?.topPerformingJobs.length ?? 0) === 0 ? (
              <p style={s.muted}>Not enough data yet — needs jobs with 5+ views.</p>
            ) : (
              <HBars
                rows={(d?.topPerformingJobs ?? []).map((r) => ({
                  label: r.title,
                  value: r.conversion,
                  suffix: '%',
                  color: TEAL,
                }))}
              />
            )}
          </section>

          {/* Job table */}
          <section style={s.card}>
            <h2 style={s.cardTitle}>All jobs</h2>
            {(d?.viewsPerJob.length ?? 0) === 0 ? (
              <p style={s.muted}>No jobs posted yet.</p>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Job</th>
                      <th style={s.th}>Status</th>
                      <th style={{ ...s.th, ...s.right }}>Views</th>
                      <th style={{ ...s.th, ...s.right }}>Applies</th>
                      <th style={{ ...s.th, ...s.right }}>Conv.</th>
                      <th style={s.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d?.viewsPerJob ?? []).map((r) => (
                      <tr key={r.jobId} style={s.tr}>
                        <td style={s.td}>{r.title}</td>
                        <td style={s.td}>
                          <span style={{ ...s.statusPill, color: STATUS_COLOR[r.status] ?? '#6b6b66' }}>
                            {titleCase(r.status)}
                          </span>
                        </td>
                        <td style={{ ...s.td, ...s.right }}>{r.views.toLocaleString('en-IN')}</td>
                        <td style={{ ...s.td, ...s.right }}>{r.applies.toLocaleString('en-IN')}</td>
                        <td style={{ ...s.td, ...s.right }}>{r.conversion}%</td>
                        <td style={{ ...s.td, ...s.right }}>
                          <Link href={`/employer/jobs/${r.jobId}/analytics`} style={s.detailLink}>Details →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

// Grouped bar timeline — two bars (views, applies) per day.
function GroupedTimeline({ data }: { data: { date: string; views: number; applies: number }[] }) {
  if (data.length === 0) return <p style={s.muted}>No activity in this window yet.</p>;
  const max = Math.max(...data.map((d) => Math.max(d.views, d.applies)), 1);
  return (
    <div style={s.chart}>
      {data.map((d) => (
        <div key={d.date} style={s.chartCol} title={`${d.date}: ${d.views} views, ${d.applies} applies`}>
          <div style={s.barPair}>
            <div style={{ ...s.bar, height: `${Math.max((d.views / max) * 100, 2)}%`, background: TEAL }} />
            <div style={{ ...s.bar, height: `${Math.max((d.applies / max) * 100, 2)}%`, background: ORANGE }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HBars({ rows }: { rows: { label: string; value: number; suffix?: string; color: string }[] }) {
  if (rows.length === 0) return <p style={s.muted}>No data.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={s.hbars}>
      {rows.map((r, i) => (
        <div key={i} style={s.hbarRow}>
          <span style={s.hbarLabel}>{r.label}</span>
          <div style={s.hbarTrack}>
            <div style={{ ...s.hbarFill, width: `${Math.max((r.value / max) * 100, 2)}%`, background: r.color }} />
          </div>
          <span style={s.hbarVal}>{r.value}{r.suffix ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: 0, color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: '4px 0 0' },
  rangeRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  rangeBtn: { border: '1px solid #e2e2da', background: '#fff', color: '#55554f', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  rangeActive: { background: TEAL, color: '#fff', borderColor: TEAL },
  refresh: { border: '1px solid #e2e2da', background: '#fff', color: '#55554f', borderRadius: 8, padding: '7px 11px', cursor: 'pointer' },
  muted: { color: '#8a8a83', fontSize: 14, padding: '6px 0' },
  err: { color: ORANGE, fontSize: 14 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-1)' },
  kpiCard: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  kpiValue: { fontSize: '1.9rem', fontWeight: 700, lineHeight: 1 },
  kpiLabel: { fontSize: 12, color: '#6b6b66' },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', margin: '0 0 12px' },
  legend: { display: 'flex', gap: 16, fontSize: 12, color: '#6b6b66' },
  dot: { display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6, verticalAlign: 'middle' },
  chart: { display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 },
  chartCol: { flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', minWidth: 4 },
  barPair: { display: 'flex', gap: 2, alignItems: 'flex-end', width: '100%', height: '100%' },
  bar: { flex: 1, borderRadius: '3px 3px 0 0', minWidth: 2 },
  hbars: { display: 'flex', flexDirection: 'column', gap: 10 },
  hbarRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#2a2a26' },
  hbarLabel: { width: 200, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  hbarTrack: { flex: 1, background: '#f1f1ec', borderRadius: 6, height: 16 },
  hbarFill: { height: '100%', borderRadius: 6 },
  hbarVal: { width: 48, textAlign: 'right', color: '#6b6b66', fontWeight: 600 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 },
  th: { textAlign: 'left', padding: '8px 10px', color: '#8a8a83', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #efefe9' },
  tr: { borderBottom: '1px solid #f4f4ef' },
  td: { padding: '10px', color: '#2a2a26', verticalAlign: 'middle' },
  right: { textAlign: 'right' },
  statusPill: { fontWeight: 700, fontSize: 12 },
  detailLink: { color: TEAL, fontWeight: 600, whiteSpace: 'nowrap' },
};
