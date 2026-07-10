import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { PremiumUpgrade } from '@/components/referral/PremiumUpgrade';

export const metadata: Metadata = {
  title: 'Premium — ddotsjobs.com',
  description: 'Upgrade to ddotsjobs Premium using the credits you earn from referrals.',
};
export const dynamic = 'force-dynamic';

export default async function PremiumPage() {
  const session = await auth();
  return (
    <main style={{ background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' }}>
      <PremiumUpgrade authed={Boolean(session?.user)} />
    </main>
  );
}
