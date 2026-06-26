import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchHero } from '@/components/home/SearchHero';
import { SECTORS } from '@/lib/constants';
import { getHomeStats, getLatestJobs, getSectorCounts, type LatestJob } from './_data';

export const revalidate = 60; // ISR

export function generateMetadata(): Metadata {
  const title = 'Jobs in Kerala — ddotsjobs.com';
  const description =
    'Find verified jobs across all 14 Kerala districts. Nursing, IT, teaching, government and more.';
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

function rupees(paise: number | null): string {
  if (paise == null) return 'Salary undisclosed';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}/mo`;
}

function relativeTime(d: Date | null): string {
  if (!d) return 'recently';
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function titleCase(s: string | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

export default async function HomePage() {
  const [stats, sectorCounts, latest] = await Promise.all([
    getHomeStats(),
    getSectorCounts(),
    getLatestJobs(),
  ]);

  const statCards = [
    { label: 'Active jobs', value: stats.activeJobs.toLocaleString('en-IN') },
    { label: 'Verified employers', value: stats.verifiedEmployers.toLocaleString('en-IN') },
    { label: 'Placements', value: stats.placements.toLocaleString('en-IN') },
    { label: 'WhatsApp subscribers', value: stats.whatsapp },
  ];

  return (
    <main style={s.page}>
      {/* ── Hero ── */}
      <section style={s.hero}>
        <div style={s.container}>
          <h1 style={s.headline}>Kerala&rsquo;s jobs, beautifully found</h1>
          <p style={s.subtext}>
            Verified jobs across all 14 districts. Salary upfront. Malayalam and English.
          </p>
          <SearchHero />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section style={s.container}>
        <div style={s.statGrid}>
          {statCards.map((c) => (
            <div key={c.label} style={s.statCard}>
              <span style={s.statValue}>{c.value}</span>
              <span style={s.statLabel}>{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sector grid ── */}
      <section style={s.container}>
        <h2 style={s.h2}>Browse by sector</h2>
        <div style={s.sectorGrid}>
          {SECTORS.map((sec) => (
            <Link key={sec.slug} href={`/jobs?category=${sec.slug}`} style={s.sectorCard}>
              <span style={s.sectorLabel}>{sec.label}</span>
              <span style={s.sectorCount}>{(sectorCounts[sec.slug] ?? 0).toLocaleString('en-IN')} jobs</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Latest jobs ── */}
      <section style={s.container}>
        <h2 style={s.h2}>Latest jobs</h2>
        {latest.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>New jobs are arriving soon.</p>
            <p style={{ color: '#6b6b66' }}>
              Set a WhatsApp alert and we&rsquo;ll message you the moment a match is posted.
            </p>
            <Link href="/seeker/alerts" style={s.emptyBtn}>
              Get WhatsApp alerts
            </Link>
          </div>
        ) : (
          <div style={s.jobList}>
            {latest.map((j: LatestJob) => (
              <Link key={j.id} href={`/jobs/${j.slug ?? j.id}`} style={s.jobCard}>
                <div style={s.jobTop}>
                  <span style={s.jobTitle}>{j.titleEn}</span>
                  <span style={s.jobTime}>{relativeTime(j.publishedAt)}</span>
                </div>
                <span style={s.jobCompany}>{j.company}</span>
                <div style={s.jobMeta}>
                  <span style={s.jobSalary}>{rupees(j.salaryMinPaise)}</span>
                  {j.district && <span style={s.jobDistrict}>{titleCase(j.district)}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── WhatsApp alert banner ── */}
      <section style={s.container}>
        <div style={s.waBanner}>
          <div>
            <p style={s.waTitle}>Get job alerts on WhatsApp</p>
            <p style={s.waSub}>Malayalam or English — your choice.</p>
          </div>
          <Link href="/seeker/alerts" style={s.waBtn}>
            Set alerts
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={{ ...s.container, ...s.footerInner }}>
          <nav style={s.footerNav}>
            <Link href="/about" style={s.footerLink}>About</Link>
            <Link href="/employer/register" style={s.footerLink}>For Employers</Link>
            <Link href="/psc" style={s.footerLink}>PSC Tracker</Link>
            <Link href="/privacy" style={s.footerLink}>Privacy</Link>
          </nav>
          <p style={s.copyright}>© 2026 ddotsjobs.com · Ddotsmedia IT Solutions</p>
        </div>
      </footer>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 1040, margin: '0 auto', padding: '0 var(--space-2)' },
  hero: { padding: 'var(--space-5) 0 var(--space-4)' },
  headline: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 'clamp(2.25rem, 8vw, 4rem)',
    lineHeight: 1.05,
    color: 'var(--color-dark)',
    margin: 0,
  },
  subtext: {
    fontSize: 'clamp(1rem, 3.5vw, 1.2rem)',
    color: '#55554f',
    margin: 'var(--space-2) 0 var(--space-3)',
    maxWidth: 560,
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 'var(--space-1)',
    marginTop: 'var(--space-2)',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 'var(--space-2)',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    border: '1px solid #efefe9',
  },
  statValue: { fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-accent)' },
  statLabel: { fontSize: 13, color: '#6b6b66' },
  h2: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: '1.6rem',
    margin: 'var(--space-4) 0 var(--space-2)',
  },
  sectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 'var(--space-1)',
  },
  sectorCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 'var(--space-2)',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    border: '1px solid #efefe9',
  },
  sectorLabel: { fontSize: 15, fontWeight: 600, color: 'var(--color-dark)' },
  sectorCount: { fontSize: 13, color: '#6b6b66' },
  jobList: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  jobCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 'var(--space-2)',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    border: '1px solid #efefe9',
  },
  jobTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  jobTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-dark)' },
  jobTime: { fontSize: 12, color: '#9a9a92', whiteSpace: 'nowrap' },
  jobCompany: { fontSize: 14, color: '#55554f' },
  jobMeta: { display: 'flex', gap: 'var(--space-1)', alignItems: 'center', flexWrap: 'wrap' },
  jobSalary: { fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' },
  jobDistrict: {
    fontSize: 12,
    color: '#6b6b66',
    background: '#f1f1ec',
    padding: '2px 10px',
    borderRadius: 'var(--radius-pill)',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 'var(--space-3)',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    border: '1px dashed #d8d8d0',
    textAlign: 'center',
    alignItems: 'center',
  },
  emptyBtn: {
    marginTop: 8,
    padding: '10px 20px',
    fontWeight: 600,
    color: '#0f0e0c',
    background: 'var(--color-brand)',
    borderRadius: 'var(--radius-pill)',
  },
  waBanner: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'var(--space-4)',
    padding: 'var(--space-3)',
    background: 'var(--color-accent)',
    borderRadius: 'var(--radius-card)',
  },
  waTitle: { fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: 0 },
  waSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', margin: '4px 0 0' },
  waBtn: {
    padding: '12px 22px',
    fontWeight: 600,
    color: '#0f0e0c',
    background: 'var(--color-brand)',
    borderRadius: 'var(--radius-pill)',
  },
  footer: { marginTop: 'var(--space-5)', borderTop: '1px solid #ececdf' },
  footerInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    paddingTop: 'var(--space-3)',
    paddingBottom: 'var(--space-3)',
  },
  footerNav: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' },
  footerLink: { fontSize: 14, color: '#55554f' },
  copyright: { fontSize: 13, color: '#9a9a92' },
};
