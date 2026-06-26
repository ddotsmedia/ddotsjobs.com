import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerTrpc } from '@/lib/trpc/server';
import { formatDate, titleCase } from '@/lib/format';

export const metadata: Metadata = { title: 'Walk-in Drives — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function WalkinDrivesPage() {
  const trpc = await getServerTrpc();
  let drives: Awaited<ReturnType<typeof trpc.walkin.myDrives>> = [];
  try {
    drives = await trpc.walkin.myDrives();
  } catch {
    drives = [];
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.head}>
          <h1 style={s.h1}>Walk-in Drives</h1>
          <Link href="/employer/jobs/new" style={s.newBtn}>Post walk-in job</Link>
        </div>

        {drives.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>No walk-in drives yet.</p>
            <p style={s.muted}>Post a walk-in job to get started.</p>
            <Link href="/employer/jobs/new" style={s.cta}>Post walk-in job →</Link>
          </div>
        ) : (
          <div style={s.list}>
            {drives.map((d) => (
              <div key={`${d.jobId}-${d.startsAt}`} style={s.card}>
                <div style={s.top}>
                  <span style={s.title}>{d.title}</span>
                  {d.noticeGeneratedAt && <span style={s.noticeBadge}>Notice ready</span>}
                </div>
                <span style={s.meta}>{formatDate(d.startsAt)} · {d.venueEn}{d.district ? ` · ${titleCase(d.district)}` : ''}</span>
                <div style={s.stats}>
                  <span>{d.registrations} registrations</span>
                  <span>· {d.knmcVerified} KNMC verified</span>
                </div>
                <div style={s.actions}>
                  <Link href={`/employer/walkin/notice?jobId=${d.jobId}`} style={s.action}>Generate notice</Link>
                  <Link href={`/employer/applicants?jobId=${d.jobId}`} style={s.action}>View applicants</Link>
                </div>
              </div>
            ))}
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
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' },
  muted: { fontSize: 13, color: '#9a9a92', margin: 0 },
  cta: { marginTop: 4, padding: '10px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  card: { display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  top: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: 600, color: 'var(--color-dark)' },
  noticeBadge: { fontSize: 11, fontWeight: 600, color: '#1d7a3a', background: '#e6f5ea', padding: '2px 9px', borderRadius: '9999px' },
  meta: { fontSize: 13, color: '#55554f' },
  stats: { display: 'flex', gap: 4, fontSize: 13, color: '#6b6b66' },
  actions: { display: 'flex', gap: 'var(--space-2)', marginTop: 2 },
  action: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
};
