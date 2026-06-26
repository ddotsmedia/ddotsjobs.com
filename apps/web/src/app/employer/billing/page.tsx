import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerTrpc } from '@/lib/trpc/server';
import { EmployerSidebar } from '@/components/employer/EmployerSidebar';
import { BillingClient } from '@/components/employer/BillingClient';

export const metadata: Metadata = { title: 'Plans & Billing — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const trpc = await getServerTrpc();

  let profile: Awaited<ReturnType<typeof trpc.employer.getProfile>> = null;
  try {
    profile = await trpc.employer.getProfile();
  } catch {
    profile = null;
  }
  if (!profile) redirect('/employer/register');

  const verified = profile.verificationStatus === 'verified';

  return (
    <div style={shell.root}>
      <EmployerSidebar company={profile.companyName ?? ''} verified={verified} />
      <main style={shell.main}>
        <h1 style={shell.title}>Plans &amp; Billing</h1>
        <BillingClient />
      </main>
    </div>
  );
}

const shell: Record<string, React.CSSProperties> = {
  root: { display: 'flex', alignItems: 'flex-start', background: 'var(--color-neutral)', minHeight: '100dvh' },
  main: { flex: 1, minWidth: 0, padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: 1100 },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,5vw,2.4rem)', margin: 0 },
};
