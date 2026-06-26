import { cache } from 'react';
import type { Metadata } from 'next';
import type { inferRouterOutputs } from '@trpc/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { AppRouter } from '@/server/routers/_app';
import { getServerTrpc } from '@/lib/trpc/server';
import { DescriptionTabs } from '@/components/jobs/DescriptionTabs';
import { IncrementView } from '@/components/jobs/IncrementView';
import { SaveJobButton } from '@/components/jobs/SaveJobButton';
import { ShareButton } from '@/components/jobs/ShareButton';
import { SegmentJobsPage } from '@/components/SegmentJobsPage';
import { DISTRICTS } from '@/lib/constants';
import { initials, relativeTime, titleCase } from '@/lib/format';

export const revalidate = 120;

// The [slug] segment doubles as district landing pages (/jobs/ernakulam) and job
// detail (/jobs/<job-slug>). District slugs are pre-rendered; job slugs are
// rendered on demand.
export function generateStaticParams() {
  return DISTRICTS.map((d) => ({ slug: d.value }));
}

function districtForSlug(slug: string) {
  return DISTRICTS.find((d) => d.value === slug) ?? null;
}

type Job = inferRouterOutputs<AppRouter>['jobs']['getBySlug'];

type Props = { params: Promise<{ slug: string }> };

const loadJob = cache(async (slug: string): Promise<Job | null> => {
  const trpc = await getServerTrpc();
  try {
    return await trpc.jobs.getBySlug({ slug });
  } catch (err) {
    if ((err as { code?: string })?.code === 'NOT_FOUND') return null;
    throw err;
  }
});

function salaryLabel(job: Job): string {
  if (!job.salaryDisclosed || job.salaryMinPaise == null) return 'Market rate';
  const min = Math.round(job.salaryMinPaise / 100).toLocaleString('en-IN');
  if (job.salaryMaxPaise != null) {
    const max = Math.round(job.salaryMaxPaise / 100).toLocaleString('en-IN');
    return `₹${min} – ₹${max}/mo`;
  }
  return `₹${min}/mo`;
}

const EMPLOYMENT_TYPE: Record<string, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACTOR',
  internship: 'INTERN',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const district = districtForSlug(slug);
  if (district) {
    const title = `Jobs in ${district.label} — ddotsjobs.com`;
    const description = `Find verified jobs in ${district.label}, Kerala. Nursing, IT, teaching and more.`;
    return { title, description, openGraph: { title, description } };
  }
  const job = await loadJob(slug);
  if (!job) return { title: 'Job not found — ddotsjobs.com' };
  const title = `${job.titleEn} at ${job.company} — ddotsjobs.com`;
  const description = job.descriptionEn.replace(/\s+/g, ' ').trim().slice(0, 155);
  return { title, description, openGraph: { title, description } };
}

function buildJsonLd(job: Job): string | null {
  // Spec: skip the schema entirely if validThrough is null.
  if (!job.validThrough) return null;
  const description = job.descriptionEn.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.titleEn,
    description: description.length >= 100 ? description : description.padEnd(100, ' '),
    datePosted: (job.publishedAt ?? new Date()).toISOString(),
    validThrough: new Date(job.validThrough).toISOString(),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      ...(job.websiteUrl ? { sameAs: job.websiteUrl } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.district ? titleCase(job.district) : 'Kerala',
        addressRegion: 'Kerala',
        addressCountry: 'IN',
      },
    },
  };

  if (EMPLOYMENT_TYPE[job.type]) data.employmentType = EMPLOYMENT_TYPE[job.type];

  if (job.salaryDisclosed && job.salaryMinPaise != null) {
    data.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'INR',
      value: {
        '@type': 'QuantitativeValue',
        minValue: Math.round(job.salaryMinPaise / 100),
        ...(job.salaryMaxPaise != null ? { maxValue: Math.round(job.salaryMaxPaise / 100) } : {}),
        unitText: 'MONTH',
      },
    };
  }

  return JSON.stringify(data);
}

export default async function JobDetailPage({ params }: Props) {
  const { slug } = await params;

  // District landing page branch.
  const district = districtForSlug(slug);
  if (district) {
    let items: Awaited<ReturnType<Awaited<ReturnType<typeof getServerTrpc>>['jobs']['segment']>>['items'] = [];
    try {
      const trpc = await getServerTrpc();
      items = (await trpc.jobs.segment({ district: district.value, limit: 50 })).items;
    } catch {
      items = [];
    }
    return (
      <SegmentJobsPage
        title={`Jobs in ${district.label}`}
        subtitle={`Verified jobs in ${district.label}, Kerala.`}
        items={items}
      />
    );
  }

  const job = await loadJob(slug);
  if (!job) notFound();

  const session = await auth();
  const role = session?.user?.role;
  const authed = Boolean(session?.user);
  const isSeeker = role === 'seeker';
  const isEmployerOrAdmin = role === 'employer' || role === 'admin';

  let initialSaved = false;
  if (isSeeker) {
    try {
      const trpc = await getServerTrpc();
      initialSaved = (await trpc.jobs.isSaved({ jobId: job.id })).saved;
    } catch {
      initialSaved = false;
    }
  }

  const applyHref = authed
    ? `/jobs/${slug}/apply`
    : `/login?redirect=${encodeURIComponent(`/jobs/${slug}/apply`)}`;
  const salary = salaryLabel(job);
  const jsonLd = buildJsonLd(job);
  const logoUrl = job.logoR2Key
    ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''}/${job.logoR2Key}`
    : null;
  const requiresKnmc = job.requiredCertifications.some((c) => c.toLowerCase() === 'knmc');

  return (
    <main style={s.page}>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      )}
      <IncrementView jobId={job.id} />

      <div style={s.container}>
        {/* Breadcrumb */}
        <nav style={s.crumb} aria-label="Breadcrumb">
          <Link href="/jobs" style={s.crumbLink}>Jobs</Link>
          <span style={s.crumbSep}>→</span>
          {job.categorySlug && (
            <>
              <Link href={`/jobs?category=${job.categorySlug}`} style={s.crumbLink}>
                {titleCase(job.categorySlug)}
              </Link>
              <span style={s.crumbSep}>→</span>
            </>
          )}
          <span style={s.crumbCurrent}>{job.titleEn}</span>
        </nav>

        <div style={s.grid}>
          {/* Main column */}
          <div style={s.mainCol}>
            <header style={s.header}>
              <div style={s.logo} aria-hidden>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" width={56} height={56} style={s.logoImg} />
                ) : (
                  initials(job.company)
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={s.title}>{job.titleEn}</h1>
                <div style={s.companyRow}>
                  <span style={s.company}>{job.company}</span>
                  {job.isVerified && <span style={s.shield} title="Verified employer">🛡 Verified</span>}
                </div>
                <div style={s.metaRow}>
                  {job.district && <span>{titleCase(job.district)}</span>}
                  <span>·</span>
                  <span>{titleCase(job.type)}</span>
                  <span>·</span>
                  <span>{relativeTime(job.publishedAt)}</span>
                </div>
                <div style={s.salary}>{salary}</div>
                <div style={s.badges}>
                  {requiresKnmc && <span style={{ ...s.badge, ...s.badgeKnmc }}>KNMC required</span>}
                  {job.valuesGulfExperience && <span style={{ ...s.badge, ...s.badgeGulf }}>Gulf Return</span>}
                  {job.isWalkIn && <span style={{ ...s.badge, ...s.badgeWalk }}>Walk-in</span>}
                  {job.itPark && <span style={s.badge}>{titleCase(job.itPark)}</span>}
                </div>
              </div>
            </header>

            {/* Walk-in block */}
            {job.isWalkIn && job.walkIn && (
              <section style={s.walkCard}>
                <h2 style={s.walkTitle}>Walk-in Interview</h2>
                <dl style={s.walkList}>
                  <WalkRow label="Date" value={new Date(job.walkIn.startsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                  <WalkRow
                    label="Time"
                    value={`${fmtTime(job.walkIn.startsAt)}${job.walkIn.endsAt ? ` – ${fmtTime(job.walkIn.endsAt)}` : ''}`}
                  />
                  <WalkRow label="Venue" value={job.walkIn.venueEn} />
                  {job.walkIn.venueMl && <WalkRow label="വേദി" value={job.walkIn.venueMl} />}
                  {job.walkIn.instructionsMl && <WalkRow label="രേഖകൾ" value={job.walkIn.instructionsMl} />}
                </dl>
              </section>
            )}

            {/* Description */}
            <section style={s.section}>
              <h2 style={s.h2}>Job description</h2>
              <DescriptionTabs en={job.descriptionEn} ml={job.descriptionMl} />
            </section>

            {/* Requirements */}
            {job.requirementsEn?.trim() && (
              <section style={s.section}>
                <h2 style={s.h2}>Requirements</h2>
                <p style={s.prose}>{job.requirementsEn}</p>
              </section>
            )}

            {/* Benefits */}
            {job.benefitsEn?.trim() && (
              <section style={s.section}>
                <h2 style={s.h2}>Benefits</h2>
                <p style={s.prose}>{job.benefitsEn}</p>
              </section>
            )}

            {/* Employer question */}
            {job.employerQuestionEn?.trim() && (
              <section style={s.qCard}>
                <p style={s.qLabel}>The employer wants to know:</p>
                <p style={s.qText}>{job.employerQuestionEn}</p>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside style={s.sidebar}>
            <div style={s.applyCard}>
              <div style={s.applySalary}>{salary}</div>
              {isEmployerOrAdmin ? (
                <button type="button" disabled style={s.applyDisabled}>Employer account</button>
              ) : (
                <Link href={applyHref} style={s.applyBtn}>Apply Now</Link>
              )}
              <SaveJobButton jobId={job.id} slug={slug} authed={authed} initialSaved={initialSaved} />
              <ShareButton title={`${job.titleEn} at ${job.company}`} />
            </div>

            <div style={s.companyCard}>
              <div style={s.companyHead}>
                <div style={s.logoSmall} aria-hidden>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" width={40} height={40} style={s.logoImg} />
                  ) : (
                    initials(job.company)
                  )}
                </div>
                <div>
                  <div style={s.companyName}>{job.company}</div>
                  <div style={s.companyMeta}>
                    {titleCase(job.employerType)}
                    {job.employerDistrict ? ` · ${titleCase(job.employerDistrict)}` : ''}
                  </div>
                </div>
              </div>
              {job.websiteUrl && (
                <a href={job.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" style={s.companyLink}>
                  Visit website
                </a>
              )}
              <Link href={`/jobs?employer=${job.employerId}`} style={s.companyLink}>
                View all jobs from this employer
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky apply bar */}
      <div className="ddj-sticky-apply">
        <span style={s.stickySalary}>{salary}</span>
        {isEmployerOrAdmin ? (
          <button type="button" disabled style={{ ...s.applyBtn, ...s.applyDisabled, width: 'auto' }}>
            Employer account
          </button>
        ) : (
          <Link href={applyHref} style={{ ...s.applyBtn, width: 'auto', padding: '0 28px' }}>
            Apply Now
          </Link>
        )}
      </div>
    </main>
  );
}

function WalkRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <dt style={{ minWidth: 64, fontWeight: 600, fontSize: 14 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 14 }}>{value}</dd>
    </div>
  );
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 88 },
  container: { width: '100%', maxWidth: 1040, margin: '0 auto', padding: '0 var(--space-2)' },
  crumb: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: 'var(--space-2) 0', fontSize: 13 },
  crumbLink: { color: 'var(--color-accent)' },
  crumbSep: { color: '#b8b8b0' },
  crumbCurrent: { color: '#6b6b66' },
  grid: { display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' },
  mainCol: { flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' },
  header: { display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', background: '#fff', padding: 'var(--space-3)', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  logo: { flex: '0 0 auto', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: 14, overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, lineHeight: 1.1, margin: 0, color: 'var(--color-dark)' },
  companyRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  company: { fontSize: 15, color: '#55554f' },
  shield: { fontSize: 12, fontWeight: 600, color: 'var(--color-accent)' },
  metaRow: { display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13, color: '#6b6b66', marginTop: 6 },
  salary: { fontSize: 18, fontWeight: 700, color: 'var(--color-accent)', marginTop: 'var(--space-1)' },
  badges: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'var(--space-1)' },
  badge: { fontSize: 12, color: '#55554f', background: '#f1f1ec', padding: '3px 10px', borderRadius: 'var(--radius-pill)' },
  badgeKnmc: { background: '#e8eefc', color: '#2a4d9b' },
  badgeGulf: { background: '#fdf0d5', color: '#9a6b00' },
  badgeWalk: { background: '#e6f5ea', color: '#1d7a3a' },
  walkCard: { background: '#fdf3da', border: '1px solid #f0d999', borderRadius: 'var(--radius-card)', padding: 'var(--space-3)' },
  walkTitle: { fontSize: 18, fontWeight: 700, margin: '0 0 var(--space-1)', fontFamily: 'var(--font-sans)', fontStyle: 'normal' },
  walkList: { display: 'flex', flexDirection: 'column', gap: 6, margin: 0 },
  section: { background: '#fff', padding: 'var(--space-3)', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.4rem', margin: '0 0 var(--space-1)' },
  prose: { fontSize: 15, lineHeight: 1.7, color: '#33332f', whiteSpace: 'pre-wrap' },
  qCard: { background: '#fdf3da', border: '1px solid #f0d999', borderRadius: 'var(--radius-card)', padding: 'var(--space-3)' },
  qLabel: { fontSize: 13, fontWeight: 700, color: '#9a6b00', margin: 0 },
  qText: { fontSize: 15, margin: '6px 0 0', color: '#33332f' },
  sidebar: { flex: '0 0 320px', width: 320, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', position: 'sticky', top: 'var(--space-2)' },
  applyCard: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', background: '#fff', padding: 'var(--space-3)', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  applySalary: { fontSize: 18, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 4 },
  applyBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 48, fontSize: 16, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)', border: 'none' },
  applyDisabled: { width: '100%', minHeight: 48, fontSize: 15, fontWeight: 600, color: '#9a9a92', background: '#f1f1ec', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'not-allowed' },
  companyCard: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', background: '#fff', padding: 'var(--space-3)', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  companyHead: { display: 'flex', gap: 'var(--space-1)', alignItems: 'center' },
  logoSmall: { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: 10, overflow: 'hidden' },
  companyName: { fontSize: 15, fontWeight: 600 },
  companyMeta: { fontSize: 13, color: '#6b6b66' },
  companyLink: { fontSize: 14, color: 'var(--color-accent)', fontWeight: 500, marginTop: 4 },
  stickySalary: { fontSize: 15, fontWeight: 700, color: 'var(--color-accent)' },
};
