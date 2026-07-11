import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerTrpc } from '@/lib/trpc/server';
import { EmployerSidebar } from '@/components/employer/EmployerSidebar';
import { CompanyProfileEditor } from '@/components/company/CompanyProfileEditor';

export const metadata: Metadata = { title: 'Company profile — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function CompanyProfileEditPage() {
  const trpc = await getServerTrpc();
  let profile: Awaited<ReturnType<typeof trpc.employer.getProfile>> = null;
  try {
    profile = await trpc.employer.getProfile();
  } catch {
    profile = null;
  }
  if (!profile) redirect('/employer/register');

  return (
    <div style={s.shell}>
      <EmployerSidebar company={profile.companyName ?? ''} verified={profile.verificationStatus === 'verified'} />
      <main style={s.main}>
        <CompanyProfileEditor />
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', alignItems: 'flex-start', background: 'var(--color-neutral)', minHeight: '100dvh' },
  main: { flex: 1, minWidth: 0, padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: 760 },
};
