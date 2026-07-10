'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { titleCase } from '@/lib/format';

type Range = '7d' | '30d' | 'all' | 'custom';
const RANGES: { key: Range; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

const TEAL = '#3A9EA5';
const YELLOW = '#F5C842';
const ORANGE = '#E8623A';
const UP = '#1d7a3a';
const DOWN = '#c0392b';

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
const STATUS_FILTERS = ['all', 'active', 'closed', 'draft', 'expired'] as const;

// yyyy-mm-dd for <input type="date"> without timezone drift.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function EmployerAnalytics() {
  const [range, setRange] = useState<Range>('7d');
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => isoDate(new Date(today.getTime() - 7 * 86_400_000)));
  const [to, setTo] = useState(() => isoDate(today));

  const customReady = range !== 'custom' || (Boolean(from) && Boolean(to) && from <= to);
  const q = trpc.employer.getAnalyticsDashboard.useQuery(
    range === 'custom' ? { range, from, to } : { range },
    { enabled: customReady },
  );
  const utils = trpc.useUtils();
  const d = q.data;

  // Table controls.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const closeMany = trpc.jobs.closeMany.useMutation({
    onSuccess: () => {
      setSelected(new Set());
      void utils.employer.getAnalyticsDashboard.invalidate();
    },
  });

  const kpis = d?.kpis;
  const trends = d?.trends;
  const cards = [
    { label: 'Total Views', value: kpis?.totalViews ?? 0, color: TEAL, trend: trends?.views ?? null, unit: '%' },
    { label: 'Total Applications', value: kpis?.totalApplications ?? 0, color: ORANGE, trend: trends?.applications ?? null, unit: '%' },
    { label: 'Conversion Rate', value: kpis ? `${kpis.conversionRate}%` : '0%', color: YELLOW, trend: trends?.conversion ?? null, unit: 'pt', tip: 'Conversion rate = applications ÷ views' },
    { label: 'Active Jobs', value: kpis?.activeJobs ?? 0, color: TEAL, trend: null, unit: '' },
  ];

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

  const rows = d?.viewsPerJob ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (statusFilter === 'all' || r.status === statusFilter) &&
        (term === '' || r.title.toLowerCase().includes(term)),
    );
  }, [rows, search, statusFilter]);

  const selectableIds = filtered.filter((r) => r.status !== 'closed').map((r) => r.jobId);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onCloseSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Close ${ids.length} selected job${ids.length === 1 ? '' : 's'}? Seekers can no longer apply.`)) return;
    closeMany.mutate({ jobIds: ids });
  };

  const exportCsv = () => {
    const header = ['jobId', 'jobTitle', 'status', 'views', 'applies', 'conversionRate', 'lastUpdated'];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      header.join(','),
      ...filtered.map((r) =>
        [r.jobId, r.title, r.status, r.views, r.applies, `${r.conversion}%`, r.updatedAt ? isoDate(new Date(r.updatedAt as unknown as string)) : ''].map(esc).join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ddotsjobs-analytics-${isoDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rangeLabel =
    range === 'custom' && d?.from && d?.to ? `${d.from} → ${d.to}` : RANGES.find((r) => r.key === range)?.label ?? '';

  return (
    <>
      <header style={s.head}>
        <div>
          <h1 style={s.h1}>Analytics</h1>
          <p style={s.sub}>Views, applications and conversion across your jobs.</p>
        </div>
        <div style={s.headActions}>
          <button type="button" onClick={exportCsv} style={s.exportBtn} disabled={!d}>⬇ CSV</button>
          <button type="button" onClick={() => window.print()} style={s.exportBtn} disabled={!d}>🖨 PDF</button>
          <button type="button" onClick={() => void utils.employer.getAnalyticsDashboard.invalidate()} style={s.refresh} title="Refresh">↻</button>
        </div>
      </header>

      {/* Range picker */}
      <div style={s.rangeRow}>
        {RANGES.map((r) => (
          <button key={r.key} type="button" onClick={() => setRange(r.key)} style={{ ...s.rangeBtn, ...(range === r.key ? s.rangeActive : {}) }}>
            {r.label}
          </button>
        ))}
        {range === 'custom' && (
          <div style={s.customRow}>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={s.dateInput} aria-label="From date" />
            <span style={s.dateSep}>→</span>
            <input type="date" value={to} min={from} max={isoDate(today)} onChange={(e) => setTo(e.target.value)} style={s.dateInput} aria-label="To date" />
          </div>
        )}
      </div>

      {q.isLoading || !customReady ? (
        <Skeletons />
      ) : q.isError ? (
        <p style={s.err}>Couldn’t load analytics. {q.error.data?.code === 'NOT_FOUND' ? 'No employer account found.' : 'Please try again.'}</p>
      ) : (
        <>
          {/* KPI cards */}
          <section style={s.kpiGrid}>
            {cards.map((c) => (
              <div key={c.label} style={s.kpiCard}>
                <span style={s.kpiTop}>
                  <span style={s.kpiLabel}>{c.label}</span>
                  {c.tip && <span style={s.tipDot} title={c.tip}>ⓘ</span>}
                </span>
                <span style={{ ...s.kpiValue, color: c.color }}>
                  {typeof c.value === 'number' ? c.value.toLocaleString('en-IN') : c.value}
                </span>
                {c.label === 'Active Jobs' ? <span style={s.trendFlat}>live now</span> : <TrendBadge value={c.trend} unit={c.unit} />}
              </div>
            ))}
          </section>
          <p style={s.rangeCaption}>Metrics for {rangeLabel}{d?.trends && (d.trends.views != null || d.trends.applications != null) ? ' · vs previous period' : ''}</p>

          {/* Timeline */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <h2 style={s.cardTitle}>Views & Applications</h2>
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
              <HBars rows={(d?.topPerformingJobs ?? []).map((r) => ({ label: r.title, value: r.conversion, suffix: '%', color: TEAL }))} />
            )}
          </section>

          {/* Job table */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <h2 style={s.cardTitle}>All jobs</h2>
              <div style={s.tableControls}>
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title…" style={s.searchBox} />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={s.statusSelect}>
                  {STATUS_FILTERS.map((sfl) => (
                    <option key={sfl} value={sfl}>{sfl === 'all' ? 'All statuses' : titleCase(sfl)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
              <div style={s.bulkBar}>
                <span style={s.bulkCount}>{selected.size} selected</span>
                <button type="button" onClick={onCloseSelected} disabled={closeMany.isPending} style={s.bulkClose}>
                  {closeMany.isPending ? 'Closing…' : 'Close selected'}
                </button>
                <button type="button" onClick={() => setSelected(new Set())} style={s.bulkClear}>Clear</button>
              </div>
            )}

            {rows.length === 0 ? (
              <p style={s.muted}>No jobs posted yet.</p>
            ) : filtered.length === 0 ? (
              <p style={s.muted}>No jobs match your filters.</p>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, ...s.checkCell }}>
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} style={s.checkbox} aria-label="Select all" />
                      </th>
                      <th style={s.th}>Job</th>
                      <th style={s.th}>Status</th>
                      <th style={{ ...s.th, ...s.right }}>Views</th>
                      <th style={{ ...s.th, ...s.right }}>Applies</th>
                      <th style={{ ...s.th, ...s.right }}>Conv.</th>
                      <th style={s.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const closed = r.status === 'closed';
                      return (
                        <tr key={r.jobId} style={s.tr}>
                          <td style={{ ...s.td, ...s.checkCell }}>
                            <input type="checkbox" checked={selected.has(r.jobId)} disabled={closed} onChange={() => toggleOne(r.jobId)} style={s.checkbox} aria-label={`Select ${r.title}`} />
                          </td>
                          <td style={s.td}>{r.title}</td>
                          <td style={s.td}><span style={{ ...s.statusPill, color: STATUS_COLOR[r.status] ?? '#6b6b66' }}>{titleCase(r.status)}</span></td>
                          <td style={{ ...s.td, ...s.right }}>{r.views.toLocaleString('en-IN')}</td>
                          <td style={{ ...s.td, ...s.right }}>{r.applies.toLocaleString('en-IN')}</td>
                          <td style={{ ...s.td, ...s.right }}>{r.conversion}%</td>
                          <td style={{ ...s.td, ...s.right }}><Link href={`/employer/jobs/${r.jobId}/analytics`} style={s.detailLink}>Details →</Link></td>
                        </tr>
                      );
                    })}
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

function TrendBadge({ value, unit }: { value: number | null; unit: string }) {
  if (value == null) return <span style={s.trendFlat}>— no prior data</span>;
  const up = value > 0;
  const flat = value === 0;
  const color = flat ? '#8a8a83' : up ? UP : DOWN;
  const arrow = flat ? '→' : up ? '▲' : '▼';
  const sign = value > 0 ? '+' : '';
  return (
    <span style={{ ...s.trend, color }}>
      {arrow} {sign}{value}{unit === 'pt' ? 'pt' : unit} vs prev
    </span>
  );
}

function Skeletons() {
  return (
    <>
      <section style={s.kpiGrid}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={s.kpiCard}>
            <span style={{ ...s.skel, width: '60%', height: 12 }} />
            <span style={{ ...s.skel, width: '45%', height: 30, marginTop: 8 }} />
            <span style={{ ...s.skel, width: '70%', height: 10, marginTop: 8 }} />
          </div>
        ))}
      </section>
      <section style={s.card}>
        <span style={{ ...s.skel, width: 160, height: 14 }} />
        <div style={{ ...s.skel, width: '100%', height: 140, marginTop: 14 }} />
      </section>
      <section style={s.card}>
        <span style={{ ...s.skel, width: 140, height: 14 }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...s.skel, width: '100%', height: 18, marginTop: 12 }} />
        ))}
      </section>
    </>
  );
}

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
  headActions: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  exportBtn: { border: '1px solid #e2e2da', background: '#fff', color: '#55554f', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 40 },
  refresh: { border: '1px solid #e2e2da', background: '#fff', color: '#55554f', borderRadius: 8, padding: '8px 11px', cursor: 'pointer', minHeight: 40 },
  rangeRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  rangeBtn: { border: '1px solid #e2e2da', background: '#fff', color: '#55554f', borderRadius: 'var(--radius-pill)', padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 40 },
  rangeActive: { background: TEAL, color: '#fff', borderColor: TEAL },
  customRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flex: '1 1 240px' },
  dateInput: { flex: '1 1 auto', border: '1px solid #e2e2da', borderRadius: 8, padding: '8px 10px', fontSize: 13, minHeight: 40, minWidth: 0 },
  dateSep: { color: '#8a8a83' },
  rangeCaption: { fontSize: 12, color: '#8a8a83', margin: '-4px 0 0' },
  muted: { color: '#8a8a83', fontSize: 14, padding: '6px 0' },
  err: { color: ORANGE, fontSize: 14 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-1)' },
  kpiCard: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  kpiTop: { display: 'flex', alignItems: 'center', gap: 6 },
  kpiLabel: { fontSize: 12, color: '#6b6b66' },
  tipDot: { fontSize: 12, color: '#b0ada2', cursor: 'help' },
  kpiValue: { fontSize: '1.9rem', fontWeight: 700, lineHeight: 1.1 },
  trend: { fontSize: 12, fontWeight: 600 },
  trendFlat: { fontSize: 11, color: '#b0ada2' },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  legend: { display: 'flex', gap: 16, fontSize: 12, color: '#6b6b66' },
  dot: { display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6, verticalAlign: 'middle' },
  tableControls: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  searchBox: { border: '1px solid #e2e2da', borderRadius: 8, padding: '8px 12px', fontSize: 13, minHeight: 40, flex: '1 1 140px', minWidth: 0 },
  statusSelect: { border: '1px solid #e2e2da', borderRadius: 8, padding: '8px 10px', fontSize: 13, minHeight: 40, background: '#fff' },
  bulkBar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fff7ed', border: '1px solid #f5d9b8', borderRadius: 10, padding: '10px 14px', marginBottom: 12 },
  bulkCount: { fontSize: 13, fontWeight: 700, color: '#8a5a12' },
  bulkClose: { background: ORANGE, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  bulkClear: { background: 'transparent', color: '#6b6b66', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 },
  th: { textAlign: 'left', padding: '8px 10px', color: '#8a8a83', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #efefe9' },
  tr: { borderBottom: '1px solid #f4f4ef' },
  td: { padding: '10px', color: '#2a2a26', verticalAlign: 'middle' },
  right: { textAlign: 'right' },
  checkCell: { width: 48, textAlign: 'center', padding: '6px' },
  checkbox: { width: 22, height: 22, cursor: 'pointer', accentColor: TEAL },
  statusPill: { fontWeight: 700, fontSize: 12 },
  detailLink: { color: TEAL, fontWeight: 600, whiteSpace: 'nowrap' },
  skel: { display: 'block', background: 'linear-gradient(90deg,#f0efe9 25%,#e6e5df 37%,#f0efe9 63%)', borderRadius: 6 },
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
};
