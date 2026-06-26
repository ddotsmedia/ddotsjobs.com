import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerTrpc } from '@/lib/trpc/server';
import { NoticeGenerator } from '@/components/employer/NoticeGenerator';

export const metadata: Metadata = { title: 'Walk-in notice — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function WalkinNoticePage() {
  let hasEmployer = false;
  try {
    const trpc = await getServerTrpc();
    hasEmployer = Boolean(await trpc.employer.getProfile());
  } catch {
    hasEmployer = false;
  }
  if (!hasEmployer) redirect('/employer/jobs');

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.title}>Walk-in Notice Generator</h1>
          <p style={s.sub}>Generate a Malayalam or English notice to share on WhatsApp.</p>
        </header>
        <NoticeGenerator />
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 600, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  header: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.4rem)', margin: 0 },
  sub: { fontSize: 14, color: '#55554f', margin: 0 },
};
