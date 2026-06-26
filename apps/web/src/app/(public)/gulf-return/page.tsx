import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerTrpc } from '@/lib/trpc/server';
import { JobCard } from '@/components/jobs/JobCard';

export const revalidate = 300;

export function generateMetadata(): Metadata {
  const title = 'Gulf Return Hub — Jobs for Returnees | ddotsjobs.com';
  const description =
    'Returned from the Gulf? Translate your Gulf experience into Kerala jobs, find Gulf-friendly employers and check NORKA schemes.';
  return { title, description, openGraph: { title, description } };
}

function benefitLabel(paise: number | null): string | null {
  if (paise == null) return null;
  return `Up to ₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

export default async function GulfReturnPage() {
  const trpc = await getServerTrpc();
  const [schemes, gulfJobs] = await Promise.all([
    trpc.pravasi.norkaSchemes(),
    trpc.jobs.list({ valuesGulfExperience: true, sort: 'latest', limit: 3 }),
  ]);

  return (
    <main style={s.page}>
      {/* Hero */}
      <section style={s.hero}>
        <div style={s.container}>
          <h1 style={s.headlineMl}>ഗൾഫിൽ നിന്ന് തിരിച്ചെത്തിയോ?</h1>
          <p style={s.headlineEn}>Returned from the Gulf?</p>
          <p style={s.sub}>
            2.1 million Keralites returned. Zero job platforms serve you. We do.
          </p>

          <div style={s.ctaGrid}>
            <Link href="/seeker/gulf-return/setup" style={{ ...s.cta, ...s.ctaPrimary }}>
              <span style={s.ctaTitle}>Register your profile</span>
              <span style={s.ctaSub}>Turn Gulf experience into Kerala job matches</span>
            </Link>
            <Link href="/jobs?gulf=1" style={s.cta}>
              <span style={s.ctaTitle}>See Gulf Return jobs</span>
              <span style={s.ctaSub}>Employers who value Gulf experience</span>
            </Link>
            <a href="#norka-schemes" style={s.cta}>
              <span style={s.ctaTitle}>Check NORKA schemes</span>
              <span style={s.ctaSub}>Loans, welfare and placement support</span>
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={s.container}>
        <div style={s.statStrip}>
          <Stat value="2.1M" label="Returnees" />
          <Stat value="14" label="Districts" />
          <Stat value="NORKA" label="Registered schemes" />
        </div>
      </section>

      {/* Gulf-friendly jobs */}
      {gulfJobs.items.length > 0 && (
        <section style={s.container}>
          <h2 style={s.h2}>Gulf Return Welcome jobs</h2>
          <div style={s.jobList}>
            {gulfJobs.items.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
          <Link href="/jobs?gulf=1" style={s.moreLink}>
            See all Gulf Return jobs →
          </Link>
        </section>
      )}

      {/* NORKA schemes */}
      <section id="norka-schemes" style={s.container}>
        <h2 style={s.h2}>NORKA schemes</h2>
        <div style={s.schemeGrid}>
          {schemes.map((sc) => (
            <div key={sc.slug} style={s.schemeCard}>
              <div style={s.schemeHead}>
                <span style={s.schemeName}>{sc.name}</span>
                <span style={s.schemeType}>{sc.benefitType?.replace(/_/g, ' ')}</span>
              </div>
              {benefitLabel(sc.maxBenefitPaise) && (
                <span style={s.schemeBenefit}>{benefitLabel(sc.maxBenefitPaise)}</span>
              )}
              {sc.descriptionMl && <p style={s.schemeDescMl}>{sc.descriptionMl}</p>}
              {sc.descriptionEn && <p style={s.schemeDesc}>{sc.descriptionEn}</p>}
              {sc.documents.length > 0 && (
                <p style={s.schemeDocs}>Documents: {sc.documents.join(', ')}</p>
              )}
              {sc.applyUrl && (
                <a href={sc.applyUrl} target="_blank" rel="noopener noreferrer nofollow" style={s.schemeApply}>
                  Apply on NORKA ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={s.statCard}>
      <span style={s.statValue}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 1000, margin: '0 auto', padding: '0 var(--space-2)' },
  hero: { padding: 'var(--space-5) 0 var(--space-3)', background: 'linear-gradient(180deg,#fdf3da 0%,var(--color-neutral) 100%)' },
  headlineMl: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(2rem,8vw,3.4rem)', lineHeight: 1.1, margin: 0, color: 'var(--color-dark)' },
  headlineEn: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.4rem,5vw,2rem)', color: 'var(--color-accent)', margin: '4px 0 0' },
  sub: { fontSize: 'clamp(1rem,3.5vw,1.2rem)', color: '#55554f', margin: 'var(--space-2) 0 var(--space-3)', maxWidth: 560 },
  ctaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--space-1)' },
  cta: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  ctaPrimary: { background: 'var(--color-brand)', border: 'none' },
  ctaTitle: { fontSize: 16, fontWeight: 700, color: 'var(--color-dark)' },
  ctaSub: { fontSize: 13, color: '#55554f' },
  statStrip: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-1)', marginTop: 'var(--space-3)' },
  statCard: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', textAlign: 'center' },
  statValue: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-accent)' },
  statLabel: { fontSize: 12, color: '#6b6b66' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.6rem', margin: 'var(--space-4) 0 var(--space-2)' },
  jobList: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  moreLink: { display: 'inline-block', marginTop: 'var(--space-1)', fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' },
  schemeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 'var(--space-1)' },
  schemeCard: { display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  schemeHead: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  schemeName: { fontSize: 16, fontWeight: 700, color: 'var(--color-dark)' },
  schemeType: { fontSize: 11, color: '#9a6b00', background: '#fdf0d5', padding: '2px 8px', borderRadius: 'var(--radius-pill)', textTransform: 'capitalize', whiteSpace: 'nowrap' },
  schemeBenefit: { fontSize: 14, fontWeight: 700, color: 'var(--color-accent)' },
  schemeDescMl: { fontSize: 14, color: '#33332f', margin: 0 },
  schemeDesc: { fontSize: 13, color: '#6b6b66', margin: 0 },
  schemeDocs: { fontSize: 12, color: '#9a9a92', margin: 0 },
  schemeApply: { fontSize: 14, fontWeight: 600, color: 'var(--color-accent)', marginTop: 2 },
};
