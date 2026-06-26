import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerTrpc } from '@/lib/trpc/server';
import { RegisterForm } from '@/components/employer/RegisterForm';

export const metadata: Metadata = { title: 'Register your company — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function EmployerRegisterPage() {
  // Already registered → straight to dashboard.
  let existing: Awaited<ReturnType<Awaited<ReturnType<typeof getServerTrpc>>['employer']['getProfile']>> = null;
  try {
    const trpc = await getServerTrpc();
    existing = await trpc.employer.getProfile();
  } catch {
    existing = null;
  }
  if (existing) redirect('/employer/dashboard');

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.title}>Register your company</h1>
          <p style={s.sub}>Start posting jobs on ddotsjobs.com. Free to start — 3 job posts included.</p>
        </header>
        <RegisterForm />
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 560, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  header: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.4rem)', margin: 0 },
  sub: { fontSize: 14, color: '#55554f', margin: 0 },
};
