import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerTrpc } from '@/lib/trpc/server';
import { JobPostForm } from '@/components/employer/JobPostForm';

export const metadata: Metadata = { title: 'Post a job — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
  let hasEmployer = false;
  try {
    const trpc = await getServerTrpc();
    hasEmployer = Boolean(await trpc.employer.getProfile());
  } catch {
    hasEmployer = false;
  }
  if (!hasEmployer) redirect('/employer/register');

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.title}>Post a job</h1>
          <p style={s.sub}>Jobs from verified employers get 3× more applications.</p>
        </header>
        <JobPostForm />
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 620, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  header: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.4rem)', margin: 0 },
  sub: { fontSize: 14, color: '#55554f', margin: 0 },
};
