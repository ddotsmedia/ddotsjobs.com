import { cache } from 'react';
import type { Metadata } from 'next';
import type { inferRouterOutputs } from '@trpc/server';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { AppRouter } from '@/server/routers/_app';
import { getServerTrpc } from '@/lib/trpc/server';
import { PscStatusBadge } from '@/components/psc/PscStatusBadge';
import { PscSubscribeButton } from '@/components/psc/PscSubscribeButton';
import { daysLeftLabel, formatDate, titleCase } from '@/lib/format';

export const revalidate = 300;

type Notif = inferRouterOutputs<AppRouter>['psc']['getByCategory'];
type Props = { params: Promise<{ categoryNo: string }> };

const loadNotif = cache(async (categoryNo: string): Promise<Notif | null> => {
  const trpc = await getServerTrpc();
  try {
    return await trpc.psc.getByCategory({ categoryNo });
  } catch (err) {
    if ((err as { code?: string })?.code === 'NOT_FOUND') return null;
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categoryNo } = await params;
  const n = await loadNotif(categoryNo);
  if (!n) return { title: 'PSC notification not found — ddotsjobs.com' };
  const title = `${n.postName} — PSC Kerala`;
  const description = `${n.postName}${n.department ? ` · ${n.department}` : ''}${
    n.totalVacancies != null ? ` · ${n.totalVacancies} vacancies` : ''
  }. Category ${n.categoryNo}.`;
  return { title, description, openGraph: { title, description } };
}

export default async function PscDetailPage({ params }: Props) {
  const { categoryNo } = await params;
  const n = await loadNotif(categoryNo);
  if (!n) notFound();

  const session = await auth();
  const role = session?.user?.role;
  const authed = Boolean(session?.user);
  const isSeeker = role === 'seeker';

  let subscribed = false;
  if (isSeeker) {
    try {
      const trpc = await getServerTrpc();
      const tracker = await trpc.psc.myTracker();
      subscribed = tracker.some((t) => t.categoryNo === n.categoryNo);
    } catch {
      subscribed = false;
    }
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.head}>
          <PscStatusBadge status={n.status} />
          <h1 style={s.h1}>{n.postName}</h1>
          {n.postNameMl && <p style={s.titleMl}>{n.postNameMl}</p>}
          <div style={s.meta}>
            {n.department && <span>{n.department}</span>}
            <span>· Category {n.categoryNo}</span>
            {n.district && <span>· {titleCase(n.district)}</span>}
          </div>
        </div>

        <div style={s.grid}>
          <div style={s.main}>
            <Field label="Vacancies" value={n.totalVacancies != null ? String(n.totalVacancies) : '—'} />
            <Field label="Scale of pay" value={n.scaleOfPay ?? '—'} />
            <Field label="Last date to apply" value={formatDate(n.applicationEnd)} />
            <Field
              label="Exam date"
              value={n.examDate ? `${formatDate(n.examDate)} (${daysLeftLabel(n.examDate)})` : 'To be announced'}
            />
            {n.qualificationText && (
              <section style={s.section}>
                <h2 style={s.h2}>Qualification</h2>
                <p style={s.prose}>{n.qualificationText}</p>
              </section>
            )}
            {n.descriptionEn && (
              <section style={s.section}>
                <h2 style={s.h2}>Details</h2>
                <p style={s.prose}>{n.descriptionEn}</p>
              </section>
            )}
            {n.sourceUrl && (
              <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" style={s.source}>
                View official notification ↗
              </a>
            )}
          </div>

          <aside style={s.sidebar}>
            <div style={s.subCard}>
              <p style={s.subTitle}>Track this notification</p>
              <p style={s.subText}>Get WhatsApp alerts on exam dates, rank lists and advice memos.</p>
              <PscSubscribeButton
                categoryNo={n.categoryNo}
                authed={authed}
                isSeeker={isSeeker}
                initialSubscribed={subscribed}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.field}>
      <span style={s.fieldLabel}>{label}</span>
      <span style={s.fieldValue}>{value}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 920, margin: '0 auto', padding: '0 var(--space-2)' },
  head: { padding: 'var(--space-3) 0 var(--space-2)', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.6rem)', margin: 0 },
  titleMl: { fontSize: 16, color: '#55554f', margin: 0 },
  meta: { display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 14, color: '#6b6b66' },
  grid: { display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' },
  main: { flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  field: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-input)', border: '1px solid #efefe9' },
  fieldLabel: { fontSize: 13, color: '#6b6b66', fontWeight: 600 },
  fieldValue: { fontSize: 14, color: 'var(--color-dark)', textAlign: 'right' },
  section: { background: '#fff', padding: 'var(--space-3)', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', marginTop: 'var(--space-1)' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', margin: '0 0 var(--space-1)' },
  prose: { fontSize: 15, lineHeight: 1.7, color: '#33332f', whiteSpace: 'pre-wrap' },
  source: { fontSize: 14, color: 'var(--color-accent)', fontWeight: 600, marginTop: 'var(--space-1)' },
  sidebar: { flex: '0 0 300px', width: 300, position: 'sticky', top: 'var(--space-2)' },
  subCard: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  subTitle: { fontSize: 16, fontWeight: 700, margin: 0 },
  subText: { fontSize: 14, color: '#6b6b66', margin: 0 },
};
