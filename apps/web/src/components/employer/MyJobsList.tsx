'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { daysUntil, formatDate, rupeesPerMonth, titleCase } from '@/lib/format';

const STATUS_UI: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#1d7a3a', bg: '#e6f5ea' },
  pending_review: { label: 'Pending review', color: '#9a6b00', bg: '#fdf0d5' },
  closed: { label: 'Closed', color: '#6b6b66', bg: '#f1f1ec' },
  rejected: { label: 'Rejected', color: '#c0392b', bg: '#fdecea' },
  draft: { label: 'Draft', color: '#6b6b66', bg: '#f1f1ec' },
};

export function MyJobsList() {
  const utils = trpc.useUtils();
  const jobs = trpc.jobs.myJobs.useQuery();
  const profile = trpc.employer.getProfile.useQuery();
  const close = trpc.jobs.close.useMutation({ onSuccess: () => void utils.jobs.myJobs.invalidate() });

  const used = profile.data?.jobsPostedThisPeriod ?? 0;
  const limit = profile.data?.jobsLimitThisPeriod ?? 3;
  const atLimit = used >= limit;
  const items = jobs.data ?? [];

  function onClose(id: string) {
    if (confirm('Close this job post?')) close.mutate({ jobId: id });
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.head}>
          <h1 style={s.h1}>My job posts</h1>
          <Link href="/employer/jobs/new" style={s.newBtn}>Post new job</Link>
        </div>

        {/* Limit bar */}
        <div style={s.limitCard}>
          <div style={s.limitTop}>
            <span>{used} of {limit} posts used this period</span>
            {atLimit && <Link href="/employer/billing" style={s.upgrade}>Upgrade plan</Link>}
          </div>
          <div style={s.limitTrack}><div style={{ ...s.limitFill, width: `${Math.min(100, (used / limit) * 100)}%` }} /></div>
        </div>

        {items.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>No jobs posted yet.</p>
            <Link href="/employer/jobs/new" style={s.cta}>Post your first job →</Link>
          </div>
        ) : (
          <div style={s.list}>
            {items.map((j) => {
              const ui = STATUS_UI[j.status] ?? STATUS_UI.draft!;
              const days = j.validThrough ? daysUntil(j.validThrough) : null;
              const closingSoon = days != null && days >= 0 && days <= 3;
              return (
                <div key={j.id} style={s.card}>
                  <div style={s.cardTop}>
                    <Link href={`/jobs/${j.slug ?? j.id}`} style={s.title}>{j.title}</Link>
                    <span style={{ ...s.badge, color: ui.color, background: ui.bg }}>{ui.label}</span>
                  </div>
                  <span style={s.meta}>{j.district ? titleCase(j.district) : '—'} · {titleCase(j.category ?? '')}</span>
                  <div style={s.stats}>
                    <span>{j.viewCount} views</span>
                    <span>· {j.applicationCount} applications</span>
                    {j.walkInStartsAt && <span>· Walk-in {formatDate(j.walkInStartsAt)}</span>}
                  </div>
                  <div style={s.metaRow}>
                    <span style={s.salary}>{rupeesPerMonth(j.salaryMinPaise, j.salaryDisclosed)}</span>
                    {days != null && days >= 0 && (
                      <span style={closingSoon ? s.closing : s.daysLeft}>
                        {closingSoon ? 'Closing soon' : `${days} days left`}
                      </span>
                    )}
                  </div>
                  <div style={s.actions}>
                    <Link href={`/employer/jobs/${j.id}/ats`} style={s.action}>Pipeline</Link>
                    <Link href={`/employer/jobs/${j.id}/applicants`} style={s.action}>Applicants</Link>
                    <Link href={`/employer/jobs/${j.id}/edit`} style={s.action}>Edit</Link>
                    {j.status !== 'closed' && (
                      <button type="button" onClick={() => onClose(j.id)} style={s.closeBtn}>Close</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 720, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.4rem)', margin: 0 },
  newBtn: { padding: '10px 18px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  limitCard: { padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', display: 'flex', flexDirection: 'column', gap: 8 },
  limitTop: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#55554f' },
  upgrade: { color: 'var(--color-accent)', fontWeight: 600 },
  limitTrack: { height: 8, background: '#ececdf', borderRadius: 999 },
  limitFill: { height: 8, background: 'var(--color-accent)', borderRadius: 999 },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' },
  cta: { padding: '10px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  card: { display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: 600, color: 'var(--color-dark)' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: '9999px', whiteSpace: 'nowrap' },
  meta: { fontSize: 13, color: '#55554f' },
  stats: { display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 13, color: '#6b6b66' },
  metaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  salary: { fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' },
  daysLeft: { fontSize: 12, color: '#9a9a92' },
  closing: { fontSize: 12, fontWeight: 600, color: '#c0392b' },
  actions: { display: 'flex', gap: 'var(--space-2)', marginTop: 2 },
  action: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
  closeBtn: { fontSize: 13, fontWeight: 600, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
};
