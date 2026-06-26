'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { initials, titleCase } from '@/lib/format';

const STATUS_UI: Record<string, { label: string; color: string; bg: string }> = {
  applied: { label: 'Applied', color: '#9a6b00', bg: '#fdf0d5' },
  under_review: { label: 'Under review', color: '#2a4d9b', bg: '#e8eefc' },
  shortlisted: { label: 'Shortlisted', color: '#1d7a3a', bg: '#e6f5ea' },
  interview_scheduled: { label: 'Interview', color: '#534ab7', bg: '#eceafa' },
  interviewed: { label: 'Interviewed', color: '#534ab7', bg: '#eceafa' },
  offer_made: { label: 'Offer', color: '#1d7a3a', bg: '#e6f5ea' },
  rejected: { label: 'Rejected', color: '#c0392b', bg: '#fdecea' },
};

function expLabel(months: number | null): string {
  if (!months) return 'Fresher';
  if (months < 12) return `${months}m exp`;
  return `${Math.floor(months / 12)}y exp`;
}

export function ApplicantPipeline() {
  const utils = trpc.useUtils();
  const jobs = trpc.employerDashboard.jobPosts.useQuery();
  const activeJobs = (jobs.data ?? []).filter((j) => j.status === 'active');
  const [jobId, setJobId] = useState<string | undefined>(undefined);

  const applicants = trpc.employerDashboard.applicants.useQuery({ jobId, limit: 10 });
  const updateStatus = trpc.applications.updateStatus.useMutation({
    onSuccess: () => void utils.employerDashboard.applicants.invalidate(),
  });

  const items = applicants.data?.items ?? [];

  function act(id: string, status: 'shortlisted' | 'interview_scheduled') {
    updateStatus.mutate({ applicationId: id, status });
  }

  return (
    <section style={s.card}>
      <div style={s.head}>
        <h2 style={s.h2}>Recent applicants</h2>
        <Link href="/employer/applicants" style={s.viewAll}>View all →</Link>
      </div>

      {activeJobs.length > 0 && (
        <select value={jobId ?? activeJobs[0]?.id ?? ''} onChange={(e) => setJobId(e.target.value)} style={s.select}>
          {activeJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
      )}

      {items.length === 0 ? (
        <div style={s.empty}>No applicants yet. Post a job to start receiving applications.</div>
      ) : (
        <div style={s.rows}>
          {items.map((a) => {
            const ui = STATUS_UI[a.statusCode] ?? STATUS_UI.applied!;
            const fit = a.fitScoreAtApply ?? 0;
            return (
              <div key={a.id} style={s.row}>
                <span style={s.avatar} aria-hidden>{initials(a.fullName ?? 'NA')}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.topRow}>
                    <span style={s.name}>{a.fullName ?? 'Candidate'}</span>
                    <span style={{ ...s.badge, color: ui.color, background: ui.bg }}>{ui.label}</span>
                  </div>
                  <div style={s.metaRow}>
                    {a.currentDistrict && <span style={s.muted}>{titleCase(a.currentDistrict)}</span>}
                    <span style={s.muted}>· {expLabel(a.totalExperienceMonths)}</span>
                    {a.knmcVerified && <span style={s.knmc}>KNMC ✓</span>}
                    {a.hasVoiceNote && <span title="Voice note" aria-label="Voice note">🎙</span>}
                  </div>
                  <div style={s.fitBar}><div style={{ ...s.fitFill, width: `${fit}%` }} /></div>
                  <div style={s.actions}>
                    {a.statusCode === 'applied' && (
                      <button type="button" disabled={updateStatus.isPending} onClick={() => act(a.id, 'shortlisted')} style={s.primary}>Shortlist</button>
                    )}
                    {a.statusCode === 'shortlisted' && (
                      <button type="button" disabled={updateStatus.isPending} onClick={() => act(a.id, 'interview_scheduled')} style={s.primary}>Schedule Interview</button>
                    )}
                    <Link href={`/employer/applicants?job=${a.userId}`} style={s.view}>View →</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', margin: 0 },
  viewAll: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
  select: { height: 42, padding: '0 10px', fontSize: 14, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)' },
  empty: { padding: 'var(--space-3)', fontSize: 14, color: '#6b6b66', textAlign: 'center' },
  rows: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  row: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid #f4f4ef' },
  avatar: { width: 40, height: 40, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: '9999px' },
  topRow: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  name: { fontSize: 15, fontWeight: 600, color: 'var(--color-dark)' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', whiteSpace: 'nowrap' },
  metaRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  muted: { fontSize: 12, color: '#9a9a92' },
  knmc: { fontSize: 11, fontWeight: 600, color: '#3A9EA5', background: '#eef6f5', padding: '1px 7px', borderRadius: '9999px' },
  fitBar: { height: 5, background: '#ececdf', borderRadius: 999, marginTop: 6 },
  fitFill: { height: 5, background: 'var(--color-brand)', borderRadius: 999 },
  actions: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 },
  primary: { minHeight: 34, padding: '0 14px', fontSize: 13, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  view: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
};
