'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

const TEAL = '#3A9EA5';
const TABS = ['pending', 'approved', 'completed', 'denied', 'all'] as const;
type Tab = (typeof TABS)[number];

function fmt(d: Date | string | null | undefined): string {
  return d ? new Date(d).toLocaleString() : '—';
}

export function DataRequests() {
  const [tab, setTab] = useState<Tab>('pending');
  const utils = trpc.useUtils();
  const q = trpc.gdpr.listDeletionRequests.useQuery({ status: tab });
  const review = trpc.gdpr.reviewDeletionRequest.useMutation({
    onSuccess: () => void utils.gdpr.listDeletionRequests.invalidate(),
  });
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const rows = q.data ?? [];

  const act = (requestId: string, decision: 'approve' | 'deny', mode?: 'soft' | 'hard') => {
    review.mutate({ requestId, decision, mode, note: note || undefined });
    setNoteFor(null);
    setNote('');
  };

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div><h1 style={s.h1}>Data deletion requests</h1><Link href="/admin/dashboard" style={s.back}>← Dashboard</Link></div>
        </header>

        <div style={s.tabs}>
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{ ...s.tab, ...(tab === t ? s.tabOn : {}) }}>{t}</button>
          ))}
        </div>

        {q.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={s.muted}>No {tab === 'all' ? '' : tab} requests.</p>
        ) : (
          <div style={s.list}>
            {rows.map((r) => (
              <div key={r.id} style={s.card}>
                <div style={s.cardTop}>
                  <div style={{ minWidth: 0 }}>
                    <div style={s.name}>{r.userName ?? 'Unknown'} <span style={s.phone}>· {r.userPhone ?? '—'}</span></div>
                    <div style={s.meta}>Requested {fmt(r.requestedAt)} · mode <strong>{r.mode}</strong></div>
                  </div>
                  <span style={{ ...s.badge, ...badgeColor(r.status) }}>{r.status}</span>
                </div>
                {r.reason && <div style={s.reason}>“{r.reason}”</div>}
                {r.reviewNote && <div style={s.meta}>Review note: {r.reviewNote}</div>}
                {r.completedAt && <div style={s.meta}>Completed {fmt(r.completedAt)}</div>}

                {r.status === 'pending' && (
                  noteFor === r.id ? (
                    <div style={s.reviewBox}>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Review note (optional)" style={s.textarea} />
                      <div style={s.actions}>
                        <button type="button" onClick={() => act(r.id, 'approve', 'soft')} disabled={review.isPending} style={s.approveBtn}>Approve (soft)</button>
                        <button type="button" onClick={() => act(r.id, 'approve', 'hard')} disabled={review.isPending} style={s.hardBtn}>Approve (hard erase)</button>
                        <button type="button" onClick={() => act(r.id, 'deny')} disabled={review.isPending} style={s.denyBtn}>Deny</button>
                        <button type="button" onClick={() => { setNoteFor(null); setNote(''); }} style={s.cancelBtn}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setNoteFor(r.id)} style={s.reviewBtn}>Review…</button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
        <p style={s.legal}>Deletion removes user data (soft = anonymise + deactivate, hard = permanent erase). Audit logs are always preserved per GDPR/CCPA.</p>
      </div>
    </main>
  );
}

function badgeColor(status: string): React.CSSProperties {
  if (status === 'pending') return { background: '#fdf3da', color: '#9a6b00' };
  if (status === 'approved') return { background: '#e6f0fb', color: '#1f5fa8' };
  if (status === 'completed') return { background: '#e6f5ea', color: '#1d7a3a' };
  return { background: '#f1f1ec', color: '#6b6b66' };
}

const s: Record<string, React.CSSProperties> = {
  main: { background: 'var(--color-neutral)', minHeight: '100dvh' },
  wrap: { width: '100%', maxWidth: 820, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: 0, color: 'var(--color-dark)' },
  back: { fontSize: 13, color: '#6b6b66', fontWeight: 600 },
  tabs: { display: 'flex', gap: 4, flexWrap: 'wrap', background: '#f1f1ec', borderRadius: 'var(--radius-pill)', padding: 3, alignSelf: 'flex-start' },
  tab: { border: 'none', background: 'transparent', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#6b6b66', cursor: 'pointer', textTransform: 'capitalize' },
  tabOn: { background: '#fff', color: '#0F1A1B', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' },
  muted: { color: '#8a8a83', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 8 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 14, fontWeight: 700, color: '#1a1916' },
  phone: { fontSize: 13, fontWeight: 400, color: '#8a8a83' },
  meta: { fontSize: 12, color: '#8a8a83' },
  reason: { fontSize: 13, color: '#3a3a34', fontStyle: 'italic' },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, textTransform: 'capitalize', flexShrink: 0 },
  reviewBtn: { alignSelf: 'flex-start', background: '#fff', color: TEAL, border: `1px solid ${TEAL}`, borderRadius: 'var(--radius-pill)', padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  reviewBox: { display: 'flex', flexDirection: 'column', gap: 8, background: '#faf9f5', borderRadius: 10, padding: 10 },
  textarea: { border: '1px solid #e2e2da', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  approveBtn: { background: '#1d7a3a', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  hardBtn: { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  denyBtn: { background: '#fff', color: '#6b6b66', border: '1px solid #e2e2da', borderRadius: 'var(--radius-pill)', padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { background: 'none', color: '#8a8a83', border: 'none', fontSize: 13, cursor: 'pointer' },
  legal: { fontSize: 12, color: '#8a8a83', marginTop: 4 },
};
