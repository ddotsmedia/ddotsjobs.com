import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getServerTrpc } from '@/lib/trpc/server';
import { SeekerSidebar } from '@/components/seeker/SeekerSidebar';
import { SavedJobs } from '@/components/seeker/SavedJobs';

export const metadata: Metadata = { title: 'Saved jobs — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function SavedJobsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/seeker/saved-jobs');

  const trpc = await getServerTrpc();
  const profile = await trpc.seeker.getProfile().catch(() => null);
  const fullName = profile?.fullName ?? '';

  return (
    <div style={s.shell}>
      <SeekerSidebar name={fullName} />
      <main style={s.main}>
        <Suspense fallback={null}>
          <SavedJobs />
        </Suspense>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', alignItems: 'flex-start', background: 'var(--color-neutral)', minHeight: '100dvh' },
  main: { flex: 1, minWidth: 0, padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: 1100 },
};
