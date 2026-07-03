'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { relativeTime } from '@/lib/format';

const ACTIONS = [
  '', 'auth.login', 'auth.logout', 'job.applied', 'post.created', 'post.deleted',
  'comment.added', 'comment.deleted', 'review.submitted', 'review.deleted',
];
const ENTITY_TYPES = ['', 'user', 'job', 'post', 'comment', 'company'];
const actionLabel = (a: string) => a.replace(/[._]/g, ' ');

export function AuditLog() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actorSearch, setActorSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const stats = trpc.admin.auditStats.useQuery();
  const q = trpc.admin.getAuditLogs.useInfiniteQuery(
    { limit: 50, action: action || undefined, entityType: entityType || undefined, actorSearch: actorSearch || undefined, from: from || undefined, to: to || undefined },
    { getNextPageParam: (last) => last.nextCursor },
  );
  const logs = q.data?.pages.flatMap((p) => p.logs) ?? [];

  const cards = [
    { label: 'Logins (24h)', value: stats.data?.logins ?? 0 },
    { label: 'Applies (24h)', value: stats.data?.applies ?? 0 },
    { label: 'Posts (24h)', value: stats.data?.posts ?? 0 },
    { label: 'Reviews (24h)', value: stats.data?.reviews ?? 0 },
  ];

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div><h1 style={s.h1}>Audit Log</h1><Link href="/admin/dashboard" style={s.back}>← Dashboard</Link></div>
        </header>

        <section style={s.statsRow}>
          {cards.map((c) => (
            <div key={c.label} style={s.statCard}><div style={s.statValue}>{c.value}</div><div style={s.statLabel}>{c.label}</div></div>
          ))}
        </section>

        <div style={s.filters}>
          <select value={action} onChange={(e) => setAction(e.target.value)} style={s.select}>
            {ACTIONS.map((a) => <option key={a} value={a}>{a ? actionLabel(a) : 'All actions'}</option>)}
          </select>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} style={s.select}>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t || 'All resources'}</option>)}
          </select>
          <input value={actorSearch} onChange={(e) => setActorSearch(e.target.value)} placeholder="Search user…" style={s.search} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={s.date} title="From" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={s.date} title="To" />
        </div>

        <div style={s.tableCard}>
          {q.isLoading ? (
            <p style={s.muted}>Loading…</p>
          ) : logs.length === 0 ? (
            <p style={s.muted}>No audit entries match.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="ddj-desktop-only" style={s.tableScroll}>
                <table style={s.table}>
                  <thead><tr style={s.thr}><th style={s.th}>Time</th><th style={s.th}>User</th><th style={s.th}>Action</th><th style={s.th}>Resource</th><th style={s.th}>IP</th><th style={s.th}></th></tr></thead>
                  <tbody>
                    {logs.map((l) => (
                      <>
                        <tr key={l.id} style={s.tr} onClick={() => setExpanded((x) => (x === l.id ? null : l.id))}>
                          <td style={s.td} title={new Date(l.createdAt).toISOString()}>{relativeTime(l.createdAt)}</td>
                          <td style={s.td}>{l.actorName ?? 'system'}</td>
                          <td style={s.td}><span style={s.actionBadge}>{actionLabel(l.action)}</span></td>
                          <td style={s.td}>{l.entityType}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ''}</td>
                          <td style={{ ...s.td, fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{l.ipAddress ?? '—'}</td>
                          <td style={s.td}>{expanded === l.id ? '▲' : '▾'}</td>
                        </tr>
                        {expanded === l.id && (
                          <tr key={`${l.id}-x`}><td colSpan={6} style={s.expandCell}><Details log={l} /></td></tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked cards */}
              <div className="ddj-mobile-only" style={s.stack}>
                {logs.map((l) => (
                  <div key={l.id} style={s.mCard} onClick={() => setExpanded((x) => (x === l.id ? null : l.id))}>
                    <div style={s.mTop}><span style={s.actionBadge}>{actionLabel(l.action)}</span><span style={s.mTime}>{relativeTime(l.createdAt)}</span></div>
                    <div style={s.mUser}>{l.actorName ?? 'system'} · {l.entityType}</div>
                    {expanded === l.id && <Details log={l} />}
                  </div>
                ))}
              </div>
            </>
          )}
          {q.hasNextPage && (
            <button type="button" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage} style={s.more}>{q.isFetchingNextPage ? 'Loading…' : 'Load more'}</button>
          )}
        </div>
      </div>
    </main>
  );
}

function Details({ log }: { log: { entityId: string | null; diff: unknown; ipAddress: string | null; userAgent: string | null; actorId: string | null } }) {
  const diffStr = JSON.stringify(log.diff ?? {}, null, 2);
  return (
    <div style={s.details}>
      <Row k="Actor ID" v={log.actorId ?? 'system'} />
      <Row k="Resource ID" v={log.entityId ?? '—'} />
      <Row k="IP" v={log.ipAddress ?? '—'} />
      <Row k="User agent" v={log.userAgent ? log.userAgent.slice(0, 200) : '—'} />
      <div style={s.detailK}>Details</div>
      <pre style={s.pre}>{diffStr.length > 500 ? diffStr.slice(0, 500) + '…' : diffStr}</pre>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div style={s.detailRow}><span style={s.detailK}>{k}</span><span style={s.detailV}>{v}</span></div>;
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', padding: 'var(--space-3) var(--space-2)' },
  wrap: { maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 },
  back: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 },
  statCard: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' },
  statValue: { fontSize: 28, fontWeight: 700, color: '#3A9EA5' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  select: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14 },
  search: { flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, outline: 'none' },
  date: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '9px 10px', fontSize: 13 },
  tableCard: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 8 },
  muted: { color: 'rgba(255,255,255,0.4)', padding: 16, textAlign: 'center' },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thr: { color: 'rgba(255,255,255,0.4)', textAlign: 'left' },
  th: { padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' },
  tr: { borderTop: '1px solid rgba(255,255,255,0.06)', color: '#e8e8e2', cursor: 'pointer' },
  td: { padding: '10px 10px', whiteSpace: 'nowrap' },
  actionBadge: { fontSize: 11, background: 'rgba(58,158,165,0.2)', color: '#7fd4da', borderRadius: 999, padding: '2px 8px', textTransform: 'capitalize' },
  expandCell: { padding: '0 10px 12px', background: 'rgba(0,0,0,0.15)' },
  stack: { display: 'flex', flexDirection: 'column', gap: 8 },
  mCard: { background: '#14201F', borderRadius: 10, padding: 12, cursor: 'pointer' },
  mTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  mTime: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  mUser: { fontSize: 13, color: '#d8d8d2', marginTop: 4 },
  details: { display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 },
  detailRow: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  detailK: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' },
  detailV: { fontSize: 12, color: '#d8d8d2', wordBreak: 'break-all', textAlign: 'right' },
  pre: { background: '#0F1A1B', color: '#8DC63F', borderRadius: 8, padding: 10, fontSize: 12, overflowX: 'auto', margin: '4px 0 0' },
  more: { display: 'block', margin: '12px auto 0', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
};
