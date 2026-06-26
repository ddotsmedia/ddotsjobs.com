'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { inferRouterOutputs } from '@trpc/server';
import { trpc } from '@/lib/trpc/client';
import type { AppRouter } from '@/server/routers/_app';
import { FitScoreRing } from '@/components/FitScoreRing';
import { initials, relativeTime, rupeesPerMonth, titleCase } from '@/lib/format';

type Item = inferRouterOutputs<AppRouter>['applications']['myApplications']['items'][number];

const TABS = [
  { key: 'all', label: 'All', status: undefined },
  { key: 'applied', label: 'Applied', status: 'applied' },
  { key: 'shortlisted', label: 'Shortlisted', status: 'shortlisted' },
  { key: 'interview', label: 'Interview', status: 'interview_scheduled' },
  { key: 'offer', label: 'Offer', status: 'offer_made' },
  { key: 'rejected', label: 'Rejected', status: 'rejected' },
] as const;

const STATUS_UI: Record<string, { label: string; color: string; bg: string }> = {
  applied: { label: 'Applied', color: '#9a6b00', bg: '#fdf0d5' },
  under_review: { label: 'Under review', color: '#2a4d9b', bg: '#e8eefc' },
  shortlisted: { label: 'Shortlisted', color: '#1d7a3a', bg: '#e6f5ea' },
  interview_scheduled: { label: 'Interview', color: '#534ab7', bg: '#eceafa' },
  interviewed: { label: 'Interviewed', color: '#534ab7', bg: '#eceafa' },
  offer_made: { label: 'Offer', color: '#1d7a3a', bg: '#e6f5ea' },
  rejected: { label: 'Rejected', color: '#c0392b', bg: '#fdecea' },
  withdrawn: { label: 'Withdrawn', color: '#6b6b66', bg: '#f1f1ec' },
};

function fmtInterview(d: Date | string): string {
  return new Date(d).toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function ApplicationsList() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');
  const [extra, setExtra] = useState<Item[]>([]);
  const [moreCursor, setMoreCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const status = TABS.find((t) => t.key === tab)?.status;
  const query = trpc.applications.myApplications.useQuery({ status, limit: 10 });
  const withdraw = trpc.applications.withdraw.useMutation({
    onSuccess: () => {
      setExtra([]);
      setMoreCursor(null);
      void utils.applications.myApplications.invalidate();
    },
  });

  const items = [...(query.data?.items ?? []), ...extra];
  const cursor = extra.length > 0 ? moreCursor : (query.data?.nextCursor ?? null);

  function switchTab(key: (typeof TABS)[number]['key']) {
    setTab(key);
    setExtra([]);
    setMoreCursor(null);
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await utils.applications.myApplications.fetch({ status, cursor, limit: 10 });
      setExtra((p) => [...p, ...res.items]);
      setMoreCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  function onWithdraw(id: string) {
    if (confirm('Withdraw this application?')) withdraw.mutate({ applicationId: id });
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <h1 style={s.h1}>My Applications</h1>

        <div style={s.tabs}>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => switchTab(t.key)} style={{ ...s.tab, ...(tab === t.key ? s.tabOn : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>
              {tab === 'all' ? 'No applications yet.' : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} applications yet.`}
            </p>
            {tab === 'all' && <Link href="/jobs" style={s.browse}>Browse jobs</Link>}
          </div>
        ) : (
          <div style={s.list}>
            {items.map((a) => {
              const ui = STATUS_UI[a.statusCode] ?? STATUS_UI.applied!;
              return (
                <div key={a.id} style={s.card}>
                  <div style={s.logo} aria-hidden>{initials(a.company)}</div>
                  <div style={s.body}>
                    <div style={s.topRow}>
                      <Link href={`/jobs/${a.slug ?? a.id}`} style={s.title}>{a.title}</Link>
                      <span style={{ ...s.badge, color: ui.color, background: ui.bg }}>{ui.label}</span>
                    </div>
                    <span style={s.company}>{a.company}{a.district ? ` · ${titleCase(a.district)}` : ''}</span>
                    <div style={s.metaRow}>
                      <span style={s.salary}>{rupeesPerMonth(a.salaryMinPaise, a.salaryDisclosed)}</span>
                      <span style={s.applied}>{relativeTime(a.createdAt)}</span>
                    </div>
                    {a.interviewScheduledAt && (
                      <span style={s.interview}>Interview: {fmtInterview(a.interviewScheduledAt)}</span>
                    )}
                    {a.statusCode === 'applied' && (
                      <button type="button" onClick={() => onWithdraw(a.id)} style={s.withdraw}>Withdraw</button>
                    )}
                  </div>
                  {a.fitScoreAtApply != null && (
                    <div style={s.ring}><FitScoreRing score={a.fitScoreAtApply} size="sm" /></div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {cursor && items.length > 0 && (
          <button type="button" onClick={loadMore} disabled={loading} style={s.more}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 640, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.4rem)', margin: 0 },
  tabs: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 },
  tab: { flex: '0 0 auto', minHeight: 38, padding: '0 14px', fontSize: 13, fontWeight: 600, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer', whiteSpace: 'nowrap' },
  tabOn: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' },
  browse: { padding: '10px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  card: { display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  logo: { flex: '0 0 auto', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: 12 },
  body: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  topRow: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: 600, color: 'var(--color-dark)' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: '9999px', whiteSpace: 'nowrap' },
  company: { fontSize: 13, color: '#55554f' },
  metaRow: { display: 'flex', gap: 'var(--space-2)', alignItems: 'center' },
  salary: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
  applied: { fontSize: 12, color: '#9a9a92' },
  interview: { fontSize: 12, color: '#534ab7', fontWeight: 600 },
  withdraw: { alignSelf: 'flex-start', marginTop: 2, fontSize: 12, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  ring: { flex: '0 0 auto' },
  more: { alignSelf: 'center', minHeight: 44, padding: '0 28px', fontSize: 15, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
};
