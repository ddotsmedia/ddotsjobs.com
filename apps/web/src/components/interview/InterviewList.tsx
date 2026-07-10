'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { relativeTime, titleCase } from '@/lib/format';

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#9a6b00',
  recording: '#2a4d9b',
  submitted: '#1d7a3a',
  reviewed: '#6b6b66',
};

export function InterviewList() {
  const q = trpc.interview.myInterviews.useQuery();
  const data = q.data;
  const rows = data?.items ?? [];
  const isEmployer = data?.role === 'employer';

  return (
    <>
      <header style={s.head}>
        <h1 style={s.h1}>Video interviews</h1>
        <p style={s.sub}>{isEmployer ? 'Interviews you sent to candidates.' : 'Interviews employers invited you to.'}</p>
      </header>
      {q.isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <div style={s.empty}><p style={{ fontWeight: 600 }}>No interviews yet.</p></div>
      ) : (
        <div style={s.list}>
          {rows.map((r) => {
            const href = isEmployer ? `/employer/interviews/${r.id}` : `/interview/${r.id}`;
            return (
              <Link key={r.id} href={href} style={s.row}>
                <div style={{ minWidth: 0 }}>
                  <div style={s.title}>{r.jobTitle}</div>
                  <div style={s.meta}>{isEmployer ? 'Candidate' : 'From'}: {r.counterpartName ?? '—'} · {relativeTime(r.createdAt)}</div>
                </div>
                <span style={{ ...s.status, color: STATUS_COLOR[r.status] ?? '#6b6b66' }}>{titleCase(r.status)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { marginBottom: 4 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: 0, color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: '4px 0 0' },
  muted: { color: '#8a8a83', fontSize: 14 },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 13, color: '#6b6b66' },
  status: { fontSize: 12, fontWeight: 700, flexShrink: 0 },
};
