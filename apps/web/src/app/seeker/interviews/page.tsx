import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getServerTrpc } from '@/lib/trpc/server';
import { SeekerSidebar } from '@/components/seeker/SeekerSidebar';
import { InterviewList } from '@/components/interview/InterviewList';

export const metadata: Metadata = { title: 'Video interviews — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function SeekerInterviewsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/seeker/interviews');
  const trpc = await getServerTrpc();
  const profile = await trpc.seeker.getProfile().catch(() => null);

  return (
    <div style={s.shell}>
      <SeekerSidebar name={profile?.fullName ?? ''} />
      <main style={s.main}>
        <InterviewList />
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', alignItems: 'flex-start', background: 'var(--color-neutral)', minHeight: '100dvh' },
  main: { flex: 1, minWidth: 0, padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: 720 },
};
