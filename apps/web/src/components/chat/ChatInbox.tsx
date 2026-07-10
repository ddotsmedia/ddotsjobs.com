'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { initials, relativeTime } from '@/lib/format';

const TEAL = '#3A9EA5';

export function ChatInbox() {
  const q = trpc.chat.getConversations.useQuery(undefined, { refetchInterval: 10_000 });
  const [search, setSearch] = useState('');
  const rows = q.data ?? [];

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return t ? rows.filter((r) => r.peerName.toLowerCase().includes(t)) : rows;
  }, [rows, search]);

  return (
    <div style={s.wrap}>
      <header style={s.header}>
        <h1 style={s.h1}>Messages</h1>
      </header>

      {q.isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon} aria-hidden>💬</div>
          <p style={s.emptyTitle}>No conversations yet.</p>
          <p style={s.emptySub}>Start by applying to a job or messaging an employer from a job post.</p>
          <Link href="/jobs" style={s.browse}>Browse jobs</Link>
        </div>
      ) : (
        <>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" style={s.searchBox} />
          <div style={s.list}>
            {filtered.map((r) => (
              <Link key={r.id} href={`/chat/${r.id}`} style={s.row}>
                <span style={s.avatar} aria-hidden>{initials(r.peerName)}</span>
                <div style={s.body}>
                  <div style={s.rowTop}>
                    <span style={s.name}>{r.peerName}</span>
                    {r.lastMessageAt && <span style={s.time}>{relativeTime(r.lastMessageAt)}</span>}
                  </div>
                  <div style={s.rowBottom}>
                    <span style={{ ...s.preview, ...(r.unread > 0 ? s.previewUnread : {}) }}>
                      {r.lastMessage ?? 'No messages yet'}
                    </span>
                    {r.unread > 0 && <span style={s.badge}>{r.unread}</span>}
                  </div>
                  <span style={s.roleBadge}>{r.peerRole === 'employer' ? 'Employer' : r.peerRole === 'admin' ? 'Admin' : 'Job seeker'}</span>
                </div>
              </Link>
            ))}
            {filtered.length === 0 && <p style={s.muted}>No conversations match “{search}”.</p>}
          </div>
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', maxWidth: 720, margin: '0 auto', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: 0, color: 'var(--color-dark)' },
  searchBox: { border: '1px solid #e2e2da', borderRadius: 10, padding: '11px 14px', fontSize: 14, minHeight: 44 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  avatar: { width: 46, height: 46, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: TEAL, background: '#eef6f5', borderRadius: '50%' },
  body: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  rowTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  name: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  time: { fontSize: 12, color: '#b0ad9f', whiteSpace: 'nowrap', flexShrink: 0 },
  rowBottom: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  preview: { fontSize: 14, color: '#6b6860', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 },
  previewUnread: { color: '#1a1916', fontWeight: 600 },
  badge: { minWidth: 20, height: 20, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: TEAL, borderRadius: 999, flexShrink: 0 },
  roleBadge: { fontSize: 11, color: '#9a9a92' },
  muted: { color: '#8a8a83', fontSize: 14, textAlign: 'center', padding: 12 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 'var(--space-4)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', textAlign: 'center' },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontWeight: 700, fontSize: 16, color: 'var(--color-dark)', margin: 0 },
  emptySub: { color: '#6b6b66', fontSize: 14, margin: 0 },
  browse: { marginTop: 8, padding: '10px 24px', fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
};
