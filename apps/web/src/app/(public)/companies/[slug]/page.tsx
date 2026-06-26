import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { auth } from '@/lib/auth';
import { getServerTrpc } from '@/lib/trpc/server';
import { Stars } from '@/components/reviews/Stars';
import { ReviewCard, type ReviewView } from '@/components/reviews/ReviewCard';
import { initials, rupeesPerMonth, titleCase } from '@/lib/format';

export const revalidate = 300; // ISR

async function fetchData(slug: string) {
  const trpc = await getServerTrpc();
  try {
    return await trpc.reviews.getForEmployer({ employerSlug: slug, limit: 10 });
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') return null;
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchData(slug);
  if (!data) return { title: 'Company — ddotsjobs.com' };
  const title = `${data.employer.name} reviews & jobs — ddotsjobs.com`;
  return { title, description: `Employee reviews and open jobs at ${data.employer.name} on ddotsjobs.com.` };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, session] = await Promise.all([fetchData(slug), auth()]);
  if (!data) notFound();

  const { employer, reviews, stats, womenFriendlyBadge, jobs } = data;
  const isAuthed = Boolean(session?.user);
  const avg = stats.avgOverall ?? 0;

  return (
    <main style={s.page}>
      <div style={s.container}>
        {/* Header */}
        <header style={s.header}>
          <div style={{ ...s.logo, background: employer.logoUrl ? '#fff' : '#0f0e0c' }}>
            {employer.logoUrl ? (
              <Image src={employer.logoUrl} alt={employer.name} width={64} height={64} sizes="64px" priority style={s.logoImg} />
            ) : (
              <span style={s.logoText}>{initials(employer.name)}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={s.name}>{employer.name}</h1>
            <div style={s.metaRow}>
              <span style={s.typeBadge}>{titleCase(employer.type)}</span>
              {employer.district && <span style={s.metaText}>{titleCase(employer.district)}</span>}
              {employer.verified && <span style={s.verifiedBadge}>✓ Verified</span>}
              {employer.websiteUrl && (
                <a href={employer.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" style={s.website}>Website ↗</a>
              )}
            </div>
            {womenFriendlyBadge && <span style={s.womenBadge}>Women-friendly workplace ✓</span>}
          </div>
        </header>

        {/* Stats row */}
        <section style={s.statsRow}>
          <div style={s.statBig}>
            <span style={s.avgNum}>{avg.toFixed(1)}</span>
            <Stars value={avg} size={20} />
            <span style={s.statSub}>{stats.total} review{stats.total === 1 ? '' : 's'}</span>
          </div>
          <div style={s.statMini}><span style={s.miniLabel}>Work culture</span><span style={s.miniVal}>{stats.avgCulture != null ? stats.avgCulture.toFixed(1) : '—'}</span></div>
          <div style={s.statMini}><span style={s.miniLabel}>Work-life</span><span style={s.miniVal}>{stats.avgWlb != null ? stats.avgWlb.toFixed(1) : '—'}</span></div>
          <div style={s.statMini}><span style={s.miniLabel}>Pay</span><span style={s.miniVal}>{stats.avgPay != null ? stats.avgPay.toFixed(1) : '—'}</span></div>
        </section>

        <Link href={`/seeker/companies/${employer.slug}/review`} style={s.writeBtn}>Write a review</Link>

        {/* Reviews */}
        <h2 style={s.h2}>Reviews</h2>
        {reviews.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>No reviews yet. Be the first to review.</p>
          </div>
        ) : (
          <div style={s.reviewList}>
            {reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={{ ...(r as unknown as ReviewView), createdAt: r.createdAt as unknown as string, isAuthed }}
              />
            ))}
          </div>
        )}

        {/* Jobs from this employer */}
        {jobs.length > 0 && (
          <section>
            <h2 style={s.h2}>Open jobs</h2>
            <div style={s.jobList}>
              {jobs.map((j) => (
                <Link key={j.id} href={`/jobs/${j.slug ?? j.id}`} style={s.jobCard}>
                  <span style={s.jobTitle}>{j.titleEn}</span>
                  <span style={s.jobMeta}>
                    <span style={s.jobSalary}>{rupeesPerMonth(j.salaryMinPaise, j.salaryDisclosed)}</span>
                    {j.district && <span style={s.jobDistrict}>{titleCase(j.district)}</span>}
                  </span>
                </Link>
              ))}
            </div>
            <Link href={`/jobs?employer=${employer.id}`} style={s.viewAll}>View all jobs →</Link>
          </section>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 760, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  header: { display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' },
  logo: { flex: '0 0 64px', width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  logoText: { color: '#fff', fontWeight: 700, fontSize: 22 },
  name: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.6rem,5vw,2.2rem)', margin: 0, color: 'var(--color-dark)' },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 6 },
  typeBadge: { fontSize: 12, fontWeight: 600, color: '#55554f', background: '#f1f1ec', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  metaText: { fontSize: 13, color: '#6b6b66' },
  verifiedBadge: { fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', background: '#e6f4f3', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  website: { fontSize: 13, color: 'var(--color-accent)', fontWeight: 600 },
  womenBadge: { display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--color-accent)', padding: '4px 12px', borderRadius: 'var(--radius-pill)' },
  statsRow: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  statBig: { display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 'var(--space-3)', borderRight: '1px solid #f1f1ec' },
  avgNum: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 40, lineHeight: 1, color: 'var(--color-brand)' },
  statSub: { fontSize: 12, color: '#6b6b66' },
  statMini: { display: 'flex', flexDirection: 'column', gap: 2 },
  miniLabel: { fontSize: 12, color: '#6b6b66' },
  miniVal: { fontSize: 20, fontWeight: 700, color: 'var(--color-dark)' },
  writeBtn: { alignSelf: 'flex-start', padding: '12px 24px', fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem', margin: 'var(--space-2) 0 0' },
  empty: { padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', textAlign: 'center' },
  reviewList: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  jobList: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginTop: 'var(--space-1)' },
  jobCard: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  jobTitle: { fontSize: 15, fontWeight: 600, color: 'var(--color-dark)' },
  jobMeta: { display: 'flex', gap: 'var(--space-1)', alignItems: 'center', flexWrap: 'wrap' },
  jobSalary: { fontSize: 13, fontWeight: 700, color: 'var(--color-brand)' },
  jobDistrict: { fontSize: 12, color: '#6b6b66', background: '#f1f1ec', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  viewAll: { display: 'inline-block', marginTop: 'var(--space-1)', fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' },
};
