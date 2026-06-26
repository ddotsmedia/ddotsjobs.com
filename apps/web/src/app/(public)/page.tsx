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

// Sector slug → icon (Phase 6 design).
const SECTOR_ICONS: Record<string, string> = {
  nursing: '🏥',
  it: '💻',
  teaching: '📚',
  government: '🏛️',
  gulf_return: '✈️',
  banking: '🏦',
  construction: '🏗️',
  retail: '🛒',
};

// Avatar palette — cycled by card index (Phase 6).
const LOGO_COLORS = ['#007D77', '#F5A800', '#534AB7', '#1A7F4E', '#C4242B', '#378ADD'];

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

function companyInitials(name: string | null): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function logoColor(index: number): string {
  return LOGO_COLORS[index % LOGO_COLORS.length]!;
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
          <p style={s.kicker}>Kerala&rsquo;s career platform</p>
          <h1 style={s.headline}>Kerala&rsquo;s jobs, beautifully found</h1>
          <p style={s.subtext}>
            Verified jobs across all 14 districts. Salary upfront. Malayalam and English.
          </p>
          <SearchHero />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section style={s.statSection}>
        <div style={s.container}>
          <div style={s.statStrip}>
            {statCards.map((c, i) => (
              <div key={c.label} style={{ ...s.statCell, ...(i > 0 ? s.statDivider : {}) }}>
                <span style={s.statValue}>{c.value}</span>
                <span style={s.statLabel}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sector grid ── */}
      <section className="hp-section" style={s.container}>
        <p style={s.eyebrow}>Explore</p>
        <h2 style={s.h2}>Browse by sector</h2>
        <div style={s.sectorGrid}>
          {SECTORS.map((sec) => (
            <Link key={sec.slug} href={`/jobs?category=${sec.slug}`} className="hp-sector" style={s.sectorCard}>
              <span style={s.sectorIcon} aria-hidden>{SECTOR_ICONS[sec.slug] ?? '📌'}</span>
              <span style={s.sectorLabel}>{sec.label}</span>
              <span style={s.sectorCount}>{(sectorCounts[sec.slug] ?? 0).toLocaleString('en-IN')} jobs</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Latest jobs ── */}
      <section className="hp-section" style={s.container}>
        <p style={s.eyebrow}>Fresh</p>
        <h2 style={s.h2}>Latest jobs</h2>
        {latest.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>New jobs are arriving soon.</p>
            <p style={{ color: '#6b6b66' }}>
              Set a WhatsApp alert and we&rsquo;ll message you the moment a match is posted.
            </p>
            <Link href="/seeker/alerts" className="hp-btn" style={s.emptyBtn}>
              Get WhatsApp alerts
            </Link>
          </div>
        ) : (
          <div style={s.jobList}>
            {latest.map((j: LatestJob, i: number) => (
              <Link key={j.id} href={`/jobs/${j.slug ?? j.id}`} className="hp-job" style={s.jobCard}>
                <div style={{ ...s.logo, background: logoColor(i) }} aria-hidden>
                  {companyInitials(j.company)}
                </div>
                <div style={s.jobBody}>
                  <div style={s.jobTop}>
                    <span style={s.jobTitle}>{j.titleEn}</span>
                    <span style={s.jobTime}>{relativeTime(j.publishedAt)}</span>
                  </div>
                  <span style={s.jobCompany}>{j.company}</span>
                  <div style={s.jobMeta}>
                    <span style={s.jobSalary}>{rupees(j.salaryMinPaise)}</span>
                    {j.district && <span style={s.jobDistrict}>{titleCase(j.district)}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── WhatsApp alert banner ── */}
      <section className="hp-section" style={{ ...s.container, paddingTop: 0 }}>
        <div style={s.waBanner}>
          <span style={s.waIcon} aria-hidden>💬</span>
          <div style={s.waText}>
            <p style={s.waTitle}>Get job alerts on WhatsApp</p>
            <p style={s.waSub}>Malayalam or English — your choice.</p>
          </div>
          <Link href="/seeker/alerts" className="hp-btn" style={s.waBtn}>
            Set alerts
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={{ ...s.container, ...s.footerInner }}>
          <div style={s.footerBrand}>
            <span style={s.wordmark}>ddotsjobs</span>
            <span style={s.footerTagline}>Kerala&rsquo;s career platform</span>
          </div>
          <nav style={s.footerNav}>
            <Link href="/about" className="hp-link" style={s.footerLink}>About</Link>
            <Link href="/employer/register" className="hp-link" style={s.footerLink}>For Employers</Link>
            <Link href="/psc" className="hp-link" style={s.footerLink}>PSC Tracker</Link>
            <Link href="/privacy" className="hp-link" style={s.footerLink}>Privacy</Link>
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
  hero: {
    padding: 'clamp(48px, 9vw, 80px) 0',
    background: 'linear-gradient(160deg, #FAFAF8 0%, #FFF8ED 60%, #EDF7F6 100%)',
  },
  kicker: {
    display: 'inline-block',
    borderLeft: '2px solid #F5A800',
    paddingLeft: 10,
    margin: '0 0 var(--space-2)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#007D77',
  },
  headline: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 'clamp(40px, 6vw, 72px)',
    lineHeight: 1.04,
    letterSpacing: '-0.02em',
    color: '#1A1916',
    margin: 0,
  },
  subtext: {
    fontSize: 'clamp(1rem, 3.5vw, 1.15rem)',
    color: '#6B6860',
    margin: 'var(--space-2) 0 var(--space-3)',
    maxWidth: 480,
  },
  // Stats strip — single bordered band with dividers.
  statSection: {},
  statStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    background: '#fff',
    borderTop: '1px solid #E8E6DF',
    borderBottom: '1px solid #E8E6DF',
  },
  statCell: {
    flex: '1 1 140px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '32px var(--space-2)',
  },
  statDivider: { borderLeft: '1px solid #E8E6DF' },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 40,
    lineHeight: 1,
    color: '#F5A800',
  },
  statLabel: { fontSize: 12, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '0.05em' },
  eyebrow: {
    margin: '0 0 8px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#B0AD9F',
  },
  h2: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 'clamp(28px, 4vw, 42px)',
    letterSpacing: '-0.02em',
    margin: '0 0 var(--space-2)',
    color: '#1A1916',
  },
  sectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 'var(--space-2)',
  },
  sectorCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 'var(--space-3) var(--space-2)',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    border: '1px solid #efefe9',
  },
  sectorIcon: { fontSize: 28, lineHeight: 1 },
  sectorLabel: { fontSize: 15, fontWeight: 600, color: 'var(--color-dark)' },
  sectorCount: { fontSize: 13, fontWeight: 600, color: '#007D77' },
  jobList: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  jobCard: {
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'flex-start',
    padding: 'var(--space-2)',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    border: '1px solid #efefe9',
  },
  logo: {
    flex: '0 0 40px',
    width: 40,
    height: 40,
    borderRadius: '9999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
  },
  jobBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  jobTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  jobTitle: { fontSize: 16, fontWeight: 600, color: '#1A1916' },
  jobTime: { fontSize: 12, color: '#B0AD9F', whiteSpace: 'nowrap' },
  jobCompany: { fontSize: 14, color: '#6B6860' },
  jobMeta: { display: 'flex', gap: 'var(--space-1)', alignItems: 'center', flexWrap: 'wrap' },
  jobSalary: { fontSize: 14, fontWeight: 600, color: '#1A1916' },
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
  // WhatsApp banner — green-tinted.
  waBanner: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
    alignItems: 'center',
    padding: 'var(--space-3)',
    background: 'rgba(37,211,102,0.06)',
    borderLeft: '3px solid #25D366',
    borderRadius: 12,
  },
  waIcon: { fontSize: 24, lineHeight: 1 },
  waText: { flex: 1, minWidth: 180 },
  waTitle: { fontSize: '1.2rem', fontWeight: 700, color: '#1A1916', margin: 0 },
  waSub: { fontSize: 14, color: '#6B6860', margin: '4px 0 0' },
  waBtn: {
    padding: '12px 24px',
    fontWeight: 600,
    color: '#fff',
    background: '#25D366',
    borderRadius: 8,
  },
  footer: { borderTop: '1px solid #E8E6DF', background: '#FAFAF8' },
  footerInner: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-3)',
    justifyContent: 'space-between',
    paddingTop: 'var(--space-4)',
    paddingBottom: 'var(--space-4)',
  },
  footerBrand: { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 240px' },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: '1.7rem',
    color: '#1A1916',
    lineHeight: 1,
  },
  footerTagline: { fontSize: 13, color: '#B0AD9F' },
  footerNav: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' },
  footerLink: { fontSize: 14, color: '#6B6860' },
  copyright: { fontSize: 12, color: '#B0AD9F', flexBasis: '100%' },
};
