import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerTrpc } from '@/lib/trpc/server';
import { PscStatusBadge } from '@/components/psc/PscStatusBadge';
import { PscUnsubscribeButton } from '@/components/psc/PscUnsubscribeButton';
import { PSC_KANBAN } from '@/lib/constants';
import { daysLeftLabel, formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'My PSC Tracker — ddotsjobs.com' };

export default async function PscTrackerPage() {
  const trpc = await getServerTrpc();
  const rows = await trpc.psc.myTracker();

  if (rows.length === 0) {
    return (
      <main style={s.page}>
        <div style={s.container}>
          <h1 style={s.h1}>My PSC Tracker</h1>
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>You haven&rsquo;t subscribed to any notifications.</p>
            <Link href="/psc" style={s.browseBtn}>Browse PSC notifications</Link>
          </div>
        </div>
      </main>
    );
  }

  const byStatus = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byStatus.get(r.status) ?? [];
    list.push(r);
    byStatus.set(r.status, list);
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <h1 style={s.h1}>My PSC Tracker</h1>
        <div style={s.board}>
          {PSC_KANBAN.map((col) => {
            const items = byStatus.get(col.key) ?? [];
            return (
              <div key={col.key} style={s.col}>
                <div style={s.colHead}>
                  {col.label} <span style={s.count}>{items.length}</span>
                </div>
                <div style={s.colBody}>
                  {items.map((r) => (
                    <div key={r.categoryNo} style={s.card}>
                      <div style={s.cardTop}>
                        <Link href={`/psc/${r.categoryNo}`} style={s.post}>{r.postName}</Link>
                        <PscStatusBadge status={r.status} />
                      </div>
                      {r.postNameMl && <span style={s.postMl}>{r.postNameMl}</span>}
                      {r.examDate && (
                        <span style={s.exam}>
                          Exam {formatDate(r.examDate)} · {daysLeftLabel(r.examDate)}
                        </span>
                      )}
                      <PscUnsubscribeButton categoryNo={r.categoryNo} />
                    </div>
                  ))}
                  {items.length === 0 && <p style={s.colEmpty}>—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 1200, margin: '0 auto', padding: '0 var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.6rem)', margin: 'var(--space-3) 0 var(--space-2)' },
  board: { display: 'flex', gap: 'var(--space-1)', overflowX: 'auto', paddingBottom: 'var(--space-2)' },
  col: { flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  colHead: { fontSize: 14, fontWeight: 700, padding: '8px 10px', color: 'var(--color-dark)' },
  count: { fontSize: 12, color: '#9a9a92' },
  colBody: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', background: '#f3f3ee', borderRadius: 'var(--radius-card)', padding: 'var(--space-1)', minHeight: 80 },
  card: { display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-input)', border: '1px solid #efefe9' },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  post: { fontSize: 14, fontWeight: 600, color: 'var(--color-dark)' },
  postMl: { fontSize: 13, color: '#55554f' },
  exam: { fontSize: 12, color: 'var(--color-accent)' },
  colEmpty: { textAlign: 'center', color: '#c4c4bc', fontSize: 13, padding: '8px 0' },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' },
  browseBtn: { padding: '10px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
};
