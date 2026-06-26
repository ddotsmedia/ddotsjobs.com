import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerTrpc } from '@/lib/trpc/server';
import { PscSearch } from '@/components/psc/PscSearch';
import { PscStatusBadge } from '@/components/psc/PscStatusBadge';
import { daysLeftLabel, formatDate } from '@/lib/format';

export const revalidate = 300;

export function generateMetadata(): Metadata {
  const title = 'PSC Tracker — ddotsjobs.com';
  const description =
    'Track Kerala PSC notifications, exam dates and rank lists. Malayalam summaries and WhatsApp alerts.';
  return { title, description, openGraph: { title, description } };
}

type SP = { q?: string | string[] };

export default async function PscPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() || undefined;

  const trpc = await getServerTrpc();
  const [list, calendar] = await Promise.all([
    trpc.psc.list({ q, limit: 20 }),
    trpc.psc.examCalendar(),
  ]);
  const upcoming = calendar.slice(0, 5);

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.h1}>PSC Tracker</h1>
          <p style={s.sub}>കേരള പി.എസ്.സി. വിജ്ഞാപനങ്ങൾ — Kerala PSC notifications, exams &amp; rank lists.</p>
        </header>

        <PscSearch initialQ={q ?? ''} />

        {/* Exam calendar strip */}
        {upcoming.length > 0 && (
          <section style={{ marginTop: 'var(--space-3)' }}>
            <h2 style={s.h2}>Upcoming exams</h2>
            <div style={s.calStrip}>
              {upcoming.map((ex) => (
                <Link key={ex.id} href={`/psc/${ex.categoryNo}`} style={s.calCard}>
                  <span style={s.calDate}>{formatDate(ex.examDate)}</span>
                  <span style={s.calPost}>{ex.postName}</span>
                  <span style={s.calDays}>{daysLeftLabel(ex.examDate)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Feed */}
        <section style={{ marginTop: 'var(--space-3)' }}>
          <h2 style={s.h2}>Notifications</h2>
          {list.items.length === 0 ? (
            <div style={s.empty}>
              <p style={{ fontWeight: 600 }}>{q ? 'No matching notifications.' : 'No notifications yet.'}</p>
              <p style={{ color: '#6b6b66' }}>
                {q ? 'Try a different search.' : 'The tracker refreshes every 4 hours — check back soon.'}
              </p>
            </div>
          ) : (
            <div style={s.feed}>
              {list.items.map((n) => (
                <Link key={n.id} href={`/psc/${n.categoryNo}`} style={s.card}>
                  <div style={s.cardTop}>
                    <span style={s.post}>{n.postName}</span>
                    <PscStatusBadge status={n.status} />
                  </div>
                  {n.postNameMl && <span style={s.postMl}>{n.postNameMl}</span>}
                  <div style={s.meta}>
                    {n.department && <span>{n.department}</span>}
                    {n.totalVacancies != null && <span>· {n.totalVacancies} vacancies</span>}
                    <span>· Cat {n.categoryNo}</span>
                  </div>
                  <div style={s.dates}>
                    {n.applicationEnd && <span>Apply by {formatDate(n.applicationEnd)}</span>}
                    {n.examDate && <span style={{ color: 'var(--color-accent)' }}>Exam {formatDate(n.examDate)}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 880, margin: '0 auto', padding: '0 var(--space-2)' },
  header: { padding: 'var(--space-4) 0 var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(2rem,7vw,3rem)', margin: 0 },
  sub: { fontSize: 15, color: '#55554f', marginTop: 'var(--space-1)' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.4rem', margin: '0 0 var(--space-1)' },
  calStrip: { display: 'flex', gap: 'var(--space-1)', overflowX: 'auto', paddingBottom: 4 },
  calCard: { flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  calDate: { fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' },
  calPost: { fontSize: 14, color: 'var(--color-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  calDays: { fontSize: 12, color: '#9a6b00' },
  feed: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  card: { display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  post: { fontSize: 16, fontWeight: 600, color: 'var(--color-dark)' },
  postMl: { fontSize: 14, color: '#55554f' },
  meta: { display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 13, color: '#6b6b66' },
  dates: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: 13, color: '#55554f' },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0' },
};
