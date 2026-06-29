'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

const RANGES = [
  { d: 7, l: '7d' },
  { d: 30, l: '30d' },
  { d: 90, l: '90d' },
  { d: 365, l: '1yr' },
];
const CAT_COLOR: Record<string, string> = {
  nursing: '#E8623A', healthcare: '#E8623A', it: '#3A9EA5', software: '#3A9EA5',
  teaching: '#8DC63F', education: '#8DC63F', government: '#5A8A8A', psc: '#5A8A8A',
  construction: '#F5C842', driver: '#C9883A', accounting: '#9B7BD4', retail: '#D46A9B',
};
const DISTRICT_ML: Record<string, string> = {
  thiruvananthapuram: 'തിരുവനന്തപുരം', kollam: 'കൊല്ലം', pathanamthitta: 'പത്തനംതിട്ട',
  alappuzha: 'ആലപ്പുഴ', kottayam: 'കോട്ടയം', idukki: 'ഇടുക്കി', ernakulam: 'എറണാകുളം',
  thrissur: 'തൃശൂർ', palakkad: 'പാലക്കാട്', malappuram: 'മലപ്പുറം', kozhikode: 'കോഴിക്കോട്',
  wayanad: 'വയനാട്', kannur: 'കണ്ണൂർ', kasaragod: 'കാസർഗോഡ്',
};
const FUNNEL: { key: string; label: string }[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'viewed', label: 'Reviewed' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'interview', label: 'Interviewed' },
  { key: 'hired', label: 'Hired' },
];
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1).replace(/_/g, ' ');

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const q = trpc.admin.analyticsOverview.useQuery({ days });
  const utils = trpc.useUtils();
  const d = q.data;

  const metrics = [
    { label: 'Total jobs', value: d?.platform.totalJobs ?? 0 },
    { label: 'Active jobs', value: d?.platform.activeJobs ?? 0 },
    { label: 'Total seekers', value: d?.platform.totalSeekers ?? 0 },
    { label: 'Total employers', value: d?.platform.totalEmployers ?? 0 },
    { label: 'Applications', value: d?.platform.totalApplications ?? 0 },
    { label: 'Verified employers', value: d?.platform.verifiedEmployers ?? 0 },
  ];

  const funnelMap = new Map<string, number>((d?.applicationFunnel ?? []).map((r) => [String(r.status), r.count]));
  const applied = funnelMap.get('applied') ?? 0;
  const funnelBase = d?.platform.totalApplications ?? 0;

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div>
            <h1 style={s.h1}>Platform Analytics</h1>
            <Link href="/admin/dashboard" style={s.back}>← Dashboard</Link>
          </div>
          <div style={s.rangeRow}>
            {RANGES.map((r) => (
              <button key={r.d} type="button" onClick={() => setDays(r.d)} style={{ ...s.rangeBtn, background: days === r.d ? '#3A9EA5' : 'rgba(255,255,255,0.08)', color: days === r.d ? '#fff' : 'rgba(255,255,255,0.6)' }}>{r.l}</button>
            ))}
            <button type="button" onClick={() => void utils.admin.analyticsOverview.invalidate()} style={s.refresh}>↻</button>
          </div>
        </header>

        {q.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : q.isError ? (
          <p style={{ color: '#E8623A' }}>Failed to load analytics.</p>
        ) : (
          <>
            {/* Section 1 — metrics */}
            <section style={s.metricsGrid}>
              {metrics.map((c) => (
                <div key={c.label} style={s.metricCard}>
                  <div style={s.metricValue}>{c.value.toLocaleString('en-IN')}</div>
                  <div style={s.metricLabel}>{c.label}</div>
                </div>
              ))}
            </section>

            {/* Section 2 — timelines */}
            <div style={s.two}>
              <Card title={`Jobs posted (${days}d)`}>
                <BarTimeline data={(d!.jobsTimeline).map((r) => ({ label: r.date, value: r.count }))} color="#3A9EA5" />
              </Card>
              <Card title={`New registrations (${days}d)`}>
                <StackedTimeline data={d!.registrationsTimeline} />
                <div style={s.legend}>
                  <span><i style={{ ...s.dot, background: '#3A9EA5' }} /> Seekers</span>
                  <span><i style={{ ...s.dot, background: '#F5C842' }} /> Employers</span>
                </div>
              </Card>
            </div>

            {/* Section 3 — distribution */}
            <div style={s.two}>
              <Card title="Jobs by category">
                <HBars rows={(d!.jobsByCategory).map((r) => ({ label: cap(r.category ?? 'other'), value: r.count, color: CAT_COLOR[r.category ?? ''] ?? '#3A9EA5' }))} />
              </Card>
              <Card title="Jobs by district">
                <HBars rows={(d!.jobsByDistrict).map((r) => ({ label: `${cap(r.district ?? '—')}${r.district && DISTRICT_ML[r.district] ? ` (${DISTRICT_ML[r.district]})` : ''}`, value: r.count, color: '#3A9EA5' }))} />
              </Card>
            </div>

            {/* Section 4 — funnel */}
            <Card title="Application pipeline">
              <div style={s.funnel}>
                {FUNNEL.map((f, i) => {
                  const v = funnelMap.get(f.key) ?? 0;
                  const pct = applied > 0 ? Math.round((v / applied) * 100) : 0;
                  const width = 100 - i * 14;
                  const hue = `hsl(${170 + i * 10}, ${45 - i * 3}%, ${42 + i * 4}%)`;
                  return (
                    <div key={f.key} style={s.funnelRow}>
                      <div style={{ ...s.funnelBar, width: `${width}%`, background: hue }}>
                        <span>{f.label}</span>
                        <span>{v.toLocaleString('en-IN')} · {pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p style={s.note}>{funnelBase.toLocaleString('en-IN')} applications · {d!.salaryDisclosedPct}% of active jobs disclose salary</p>
            </Card>

            {/* Section 5 — top professions */}
            <Card title="Top seeker professions">
              {d!.seekersByProfession.length === 0 ? (
                <p style={s.muted}>No profession data.</p>
              ) : (
                <HBars rows={d!.seekersByProfession.map((r) => ({ label: cap(r.profession ?? '—'), value: r.count, color: '#8DC63F' }))} />
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.card}>
      <h2 style={s.cardTitle}>{title}</h2>
      {children}
    </div>
  );
}

function BarTimeline({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  if (data.length === 0) return <p style={s.muted}>No data.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={s.chart}>
      {data.map((d, i) => (
        <div key={i} title={`${d.label}: ${d.value}`} style={{ ...s.bar, height: `${Math.max((d.value / max) * 100, 3)}%`, background: color }} />
      ))}
    </div>
  );
}

function StackedTimeline({ data }: { data: { date: string; seekers: number; employers: number }[] }) {
  if (data.length === 0) return <p style={s.muted}>No data.</p>;
  const max = Math.max(...data.map((d) => d.seekers + d.employers), 1);
  return (
    <div style={s.chart}>
      {data.map((d, i) => (
        <div key={i} title={`${d.date}: ${d.seekers} seekers, ${d.employers} employers`} style={s.stackCol}>
          <div style={{ height: `${(d.employers / max) * 100}%`, background: '#F5C842', borderRadius: '3px 3px 0 0' }} />
          <div style={{ height: `${(d.seekers / max) * 100}%`, background: '#3A9EA5' }} />
        </div>
      ))}
    </div>
  );
}

function HBars({ rows }: { rows: { label: string; value: number; color: string }[] }) {
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
          <span style={s.hbarVal}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', padding: 'var(--space-3) var(--space-2)' },
  wrap: { maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 },
  back: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  rangeRow: { display: 'flex', gap: 6, alignItems: 'center' },
  rangeBtn: { border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  refresh: { background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' },
  muted: { color: 'rgba(255,255,255,0.4)', padding: 8 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 },
  metricCard: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' },
  metricValue: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 36, color: '#F5C842', lineHeight: 1 },
  metricLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#3A9EA5', marginTop: 6 },
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 'var(--space-2)' },
  card: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 14px' },
  chart: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 },
  bar: { flex: 1, borderRadius: '4px 4px 0 0', minWidth: 3 },
  stackCol: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minWidth: 3 },
  legend: { display: 'flex', gap: 18, marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  dot: { display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6 },
  hbars: { display: 'flex', flexDirection: 'column', gap: 8 },
  hbarRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#e8e8e2' },
  hbarLabel: { width: 160, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  hbarTrack: { flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 16 },
  hbarFill: { height: '100%', borderRadius: 6 },
  hbarVal: { width: 36, textAlign: 'right', color: 'rgba(255,255,255,0.7)' },
  funnel: { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' },
  funnelRow: { width: '100%', display: 'flex', justifyContent: 'center' },
  funnelBar: { display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600 },
  note: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 14, textAlign: 'center' },
};
