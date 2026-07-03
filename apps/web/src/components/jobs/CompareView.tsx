'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { relativeTime, rupeesPerMonth, titleCase } from '@/lib/format';
import { useCompare } from '@/lib/useCompare';

export function CompareView({ ids }: { ids: string[] }) {
  const { remove } = useCompare();
  const [copied, setCopied] = useState(false);
  const valid = ids.length >= 2 && ids.length <= 3;
  const q = trpc.jobs.compareJobs.useQuery({ ids: valid ? ids : ['', ''] as never }, { enabled: valid });

  if (!valid) {
    return (
      <Wrap>
        <p style={s.muted}>Select 2–3 jobs to compare.</p>
        <Link href="/jobs" style={s.backLink}>← Browse jobs</Link>
      </Wrap>
    );
  }
  if (q.isLoading) return <Wrap><p style={s.muted}>Loading…</p></Wrap>;
  const jobs = q.data?.jobs ?? [];
  if (jobs.length < 2) {
    return (
      <Wrap>
        <p style={s.muted}>Not enough jobs available to compare. Some may have been removed.</p>
        <Link href="/jobs" style={s.backLink}>← Browse jobs</Link>
      </Wrap>
    );
  }
  const missing = ids.length - jobs.length;

  const salary = (j: typeof jobs[number]) => rupeesPerMonth(j.salaryMinPaise, j.salaryDisclosed);
  const rows: { label: string; render: (j: typeof jobs[number]) => React.ReactNode; bold?: boolean }[] = [
    { label: 'Company', render: (j) => <>{j.company}{j.isVerified ? ' ✓' : ''}</> },
    { label: 'Location', render: (j) => (j.isRemote ? 'Remote' : titleCase(j.district ?? j.locationText ?? '—')), bold: true },
    { label: 'Salary', render: (j) => salary(j), bold: true },
    { label: 'Job type', render: (j) => titleCase(String(j.type).replace(/_/g, ' ')) },
    { label: 'Experience', render: (j) => (j.minExperienceMonths > 0 ? `${Math.floor(j.minExperienceMonths / 12)}y+` : 'Fresher OK') },
    { label: 'Walk-in', render: (j) => (j.isWalkIn ? 'Yes' : 'No') },
    { label: 'Skills', render: (j) => (j.skills.length ? <div style={s.chips}>{j.skills.slice(0, 8).map((k) => <span key={k} style={s.chip}>{k}</span>)}</div> : '—') },
    { label: 'Certifications', render: (j) => (j.requiredCertifications.length ? j.requiredCertifications.join(', ') : '—') },
    { label: 'Benefits', render: (j) => j.benefitsEn || '—' },
    { label: 'Posted', render: (j) => relativeTime(j.publishedAt) },
  ];

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const waText = `I'm comparing ${jobs.length} jobs on ddotsjobs.com: ${jobs.map((j) => j.titleEn).join(' vs ')}`;

  return (
    <Wrap>
      <div style={s.head}>
        <h1 style={s.h1}>Compare Jobs</h1>
        <div style={s.headActions}>
          <button type="button" onClick={() => { void navigator.clipboard.writeText(shareUrl); setCopied(true); }} style={s.shareBtn}>{copied ? 'Link copied ✓' : 'Copy link'}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${waText} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" style={s.waBtn}>WhatsApp</a>
        </div>
      </div>
      {missing > 0 && <p style={s.warn}>{missing} job{missing > 1 ? 's' : ''} no longer available.</p>}

      {/* Desktop table */}
      <div style={s.tableScroll} className="ddj-desktop-only">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.thLabel}></th>
              {jobs.map((j) => (
                <th key={j.id} style={s.thJob}>
                  <Link href={`/jobs/${j.slug ?? j.id}`} style={s.jobTitle}>{j.titleEn}</Link>
                  <button type="button" onClick={() => remove(j.id)} style={s.removeX}>remove</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={s.tr}>
                <td style={s.tdLabel}>{r.label}</td>
                {jobs.map((j) => <td key={j.id} style={{ ...s.td, fontWeight: r.bold ? 700 : 400 }}>{r.render(j)}</td>)}
              </tr>
            ))}
            <tr>
              <td style={s.tdLabel}></td>
              {jobs.map((j) => <td key={j.id} style={s.td}><Link href={`/jobs/${j.slug ?? j.id}`} style={s.applyBtn}>Apply →</Link></td>)}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="ddj-mobile-only" style={s.stack}>
        {jobs.map((j) => (
          <div key={j.id} style={s.mCard}>
            <div style={s.mHead}>
              <Link href={`/jobs/${j.slug ?? j.id}`} style={s.jobTitle}>{j.titleEn}</Link>
              <button type="button" onClick={() => remove(j.id)} style={s.removeX}>remove</button>
            </div>
            {rows.map((r) => (
              <div key={r.label} style={s.mRow}><span style={s.mLabel}>{r.label}</span><span style={{ ...s.mVal, fontWeight: r.bold ? 700 : 400 }}>{r.render(j)}</span></div>
            ))}
            <Link href={`/jobs/${j.slug ?? j.id}`} style={s.applyBtn}>Apply →</Link>
          </div>
        ))}
      </div>

      <Link href="/jobs" style={s.moreBtn}>+ Compare more jobs</Link>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <main style={s.main}><div style={s.wrap}>{children}</div></main>;
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#F4F3EE', padding: 'var(--space-2)' },
  wrap: { maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  muted: { color: '#9a9a92', padding: 20, textAlign: 'center' },
  backLink: { color: '#3A9EA5', fontWeight: 600, textAlign: 'center' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, margin: 0, color: '#1A1916' },
  headActions: { display: 'flex', gap: 8 },
  shareBtn: { background: '#fff', border: '1px solid #d8d8d0', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' },
  waBtn: { background: '#8DC63F', color: '#0F1A1B', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600 },
  warn: { color: '#9a6b00', fontSize: 13, margin: 0 },
  tableScroll: { overflowX: 'auto', background: '#fff', borderRadius: 14, border: '1px solid #efefe9' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 520 },
  thLabel: { width: 130 },
  thJob: { padding: 14, textAlign: 'left', verticalAlign: 'top', borderBottom: '2px solid #efefe9', minWidth: 180 },
  jobTitle: { display: 'block', fontWeight: 700, color: '#1A1916', fontSize: 15 },
  removeX: { background: 'none', border: 'none', color: '#c0392b', fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 4 },
  tr: { borderBottom: '1px solid #f2f2ec' },
  tdLabel: { padding: '12px 14px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9a9a92', verticalAlign: 'top', whiteSpace: 'nowrap' },
  td: { padding: '12px 14px', fontSize: 14, color: '#2a2a26', verticalAlign: 'top' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  chip: { background: 'rgba(58,158,165,0.14)', color: '#2E8A91', borderRadius: 999, padding: '2px 8px', fontSize: 12 },
  applyBtn: { display: 'inline-block', background: '#3A9EA5', color: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 700, marginTop: 8 },
  stack: { display: 'flex', flexDirection: 'column', gap: 12 },
  mCard: { background: '#fff', borderRadius: 14, border: '1px solid #efefe9', padding: 16 },
  mHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  mRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: '1px solid #f6f6f1' },
  mLabel: { fontSize: 12, textTransform: 'uppercase', color: '#9a9a92', flexShrink: 0 },
  mVal: { fontSize: 14, color: '#2a2a26', textAlign: 'right' },
  moreBtn: { alignSelf: 'center', background: '#fff', border: '1px solid #d8d8d0', borderRadius: 999, padding: '10px 22px', fontSize: 14, color: '#1A1916' },
};
