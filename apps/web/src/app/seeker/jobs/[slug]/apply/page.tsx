import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getServerTrpc } from '@/lib/trpc/server';
import { ApplyForm } from '@/components/seeker/ApplyForm';
import { FitScoreRing } from '@/components/FitScoreRing';
import { rupeesPerMonth, titleCase } from '@/lib/format';

export const metadata: Metadata = { title: 'Apply — ddotsjobs.com' };

type Props = { params: Promise<{ slug: string }> };

export default async function ApplyPage({ params }: Props) {
  const { slug } = await params;
  const trpc = await getServerTrpc();

  let job: Awaited<ReturnType<typeof trpc.jobs.getBySlug>> | null = null;
  try {
    job = await trpc.jobs.getBySlug({ slug });
  } catch {
    job = null;
  }
  if (!job) notFound();

  const session = await auth();
  const isSeeker = session?.user?.role === 'seeker';

  let fit: Awaited<ReturnType<typeof trpc.fitScore.getForJob>> | null = null;
  if (isSeeker) {
    try {
      fit = await trpc.fitScore.getForJob({ jobId: job.id });
    } catch {
      fit = null;
    }
  }

  const explanation = fit ? (fit.explanationMl ?? fit.explanationEn) : null;

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.title}>{job.titleEn}</h1>
          <p style={s.meta}>
            {job.company}
            {job.district ? ` · ${titleCase(job.district)}` : ''}
          </p>
          <p style={s.salary}>{rupeesPerMonth(job.salaryMinPaise, job.salaryDisclosed)}</p>
        </header>

        {!isSeeker ? (
          <div style={s.block}>
            Employer accounts cannot apply for jobs.{' '}
            <Link href={`/jobs/${slug}`} style={s.link}>Back to job</Link>
          </div>
        ) : (
          <>
            {fit && (
              <section style={s.fitCard}>
                <FitScoreRing score={fit.overall} breakdown={fit} size="lg" />
                {explanation && <p style={s.explanation}>{explanation}</p>}
              </section>
            )}
            <ApplyForm jobId={job.id} employerQuestion={job.employerQuestionEn} />
          </>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 96 },
  container: { width: '100%', maxWidth: 560, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  header: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.6rem,6vw,2.2rem)', margin: 0 },
  meta: { fontSize: 14, color: '#55554f', margin: 0 },
  salary: { fontSize: 16, fontWeight: 700, color: 'var(--color-accent)', margin: 0 },
  block: { padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', fontSize: 14 },
  link: { color: 'var(--color-accent)', fontWeight: 600 },
  fitCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  explanation: { fontSize: 14, color: '#33332f', textAlign: 'center', lineHeight: 1.6, margin: 0 },
};
