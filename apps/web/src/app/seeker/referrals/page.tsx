import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getServerTrpc } from '@/lib/trpc/server';
import { SeekerSidebar } from '@/components/seeker/SeekerSidebar';
import { ReferralDashboard } from '@/components/referral/ReferralDashboard';

export const metadata: Metadata = { title: 'Referrals — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function ReferralsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/seeker/referrals');
  const trpc = await getServerTrpc();
  const profile = await trpc.seeker.getProfile().catch(() => null);

  return (
    <div style={s.shell}>
      <SeekerSidebar name={profile?.fullName ?? ''} />
      <main style={s.main}>
        <ReferralDashboard />
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', alignItems: 'flex-start', background: 'var(--color-neutral)', minHeight: '100dvh' },
  main: { flex: 1, minWidth: 0, padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: 760 },
};
