'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { formatDate, titleCase } from '@/lib/format';

const TEAL = '#3A9EA5';
const ORANGE = '#E8623A';
const YELLOW = '#F5C842';

export function JobAnalytics({ jobId }: { jobId: string }) {
  const q = trpc.employer.getJobAnalytics.useQuery({ jobId });
  const d = q.data;

  if (q.isLoading) return <p style={s.muted}>Loading job analytics…</p>;
  if (q.isError || !d) {
    return (
      <div>
        <Link href="/employer/analytics" style={s.back}>← Analytics</Link>
        <p style={s.err}>Job not found or not yours.</p>
      </div>
    );
  }

  const { job, timeline, applicants } = d;

  const exportCsv = () => {
    const esc = (v: unknown) => {
      const str = String(v ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [
      ['metric', 'value'].join(','),
      ['job', esc(job.title)].join(','),
      ['status', job.status].join(','),
      ['views', job.views].join(','),
      ['applyClicks', job.ctaClicks].join(','),
      ['applications', job.applies].join(','),
      ['conversionRate', `${job.conversion}%`].join(','),
      '',
      ['applicantName', 'appliedAt', 'status'].join(','),
      ...applicants.map((a) => [esc(a.name ?? 'Applicant'), new Date(a.appliedAt as unknown as string).toISOString().slice(0, 10), a.status].map(esc).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `ddotsjobs-job-${job.id}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    { label: 'Views', value: job.views, color: TEAL },
    { label: 'Apply clicks', value: job.ctaClicks, color: YELLOW },
    { label: 'Applications', value: job.applies, color: ORANGE },
    { label: 'Conversion', value: `${job.conversion}%`, color: TEAL },
  ];

  return (
    <>
      <header style={s.head}>
        <div>
          <Link href="/employer/analytics" style={s.back}>← Analytics</Link>
          <h1 style={s.h1}>{job.title}</h1>
          <span style={s.status}>{titleCase(job.status)}</span>
        </div>
        <div style={s.actions}>
          <button type="button" onClick={exportCsv} style={s.actionBtn}>⬇ CSV</button>
          <button type="button" onClick={() => window.print()} style={s.actionBtn}>🖨 PDF</button>
          {job.slug && <Link href={`/jobs/${job.slug}`} style={s.actionBtn}>View posting ↗</Link>}
          <Link href={`/employer/jobs`} style={s.actionBtn}>Edit job</Link>
        </div>
      </header>

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

      <section style={s.card}>
        <div style={s.cardHead}>
          <h2 style={s.cardTitle}>Daily views & applications (last 30 days)</h2>
          <div style={s.legend}>
            <span><i style={{ ...s.dot, background: TEAL }} /> Views</span>
            <span><i style={{ ...s.dot, background: ORANGE }} /> Applications</span>
          </div>
        </div>
        <Timeline data={timeline} />
      </section>

      <section style={s.card}>
        <h2 style={s.cardTitle}>Applicants ({applicants.length})</h2>
        {applicants.length === 0 ? (
          <p style={s.muted}>No applicants yet.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Applied</th>
                  <th style={s.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((a) => (
                  <tr key={a.id} style={s.tr}>
                    <td style={s.td}>{a.name ?? 'Applicant'}</td>
                    <td style={s.td}>{formatDate(a.appliedAt as unknown as string)}</td>
                    <td style={s.td}>{titleCase(a.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link href="/employer/applicants" style={s.viewAll}>Manage applicants →</Link>
      </section>
    </>
  );
}

function Timeline({ data }: { data: { date: string; views: number; applies: number }[] }) {
  if (data.length === 0) return <p style={s.muted}>No activity in the last 30 days.</p>;
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

const s: Record<string, React.CSSProperties> = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  back: { fontSize: 13, color: TEAL, fontWeight: 600 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.7rem', margin: '6px 0 4px', color: 'var(--color-dark)' },
  status: { fontSize: 12, fontWeight: 700, color: '#6b6b66', background: '#f1f1ec', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actionBtn: { fontSize: 13, fontWeight: 600, color: '#55554f', background: '#fff', border: '1px solid #e2e2da', borderRadius: 'var(--radius-pill)', padding: '7px 14px', cursor: 'pointer' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 'var(--space-1)' },
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
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 420 },
  th: { textAlign: 'left', padding: '8px 10px', color: '#8a8a83', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #efefe9' },
  tr: { borderBottom: '1px solid #f4f4ef' },
  td: { padding: '10px', color: '#2a2a26' },
  muted: { color: '#8a8a83', fontSize: 14, padding: '6px 0' },
  err: { color: ORANGE, fontSize: 14, marginTop: 12 },
  viewAll: { display: 'inline-block', marginTop: 12, fontSize: 14, fontWeight: 600, color: TEAL },
};
