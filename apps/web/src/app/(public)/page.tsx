import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchHero } from '@/components/home/SearchHero';
import { StatsStrip } from '@/components/home/StatsStrip';
import { WhatsappCta } from '@/components/home/WhatsappCta';
import { Logo } from '@/components/Logo';
import { SECTORS } from '@/lib/constants';
import { getHomeStats, getLatestJobs, getSectorCounts, type LatestJob } from './_data';

// Stats + latest jobs must reflect live data. ISR baked stale 0s under the
// standalone/PM2-cluster cache, so render dynamically (queries are cheap; the
// HTML is still edge-cached by Cloudflare).
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const title = 'Jobs in Kerala 2026 — ddotsjobs.com | Verified Kerala Jobs';
  const description =
    'Find verified jobs across all 14 Kerala districts. Nursing, IT, Teaching, PSC, Gulf Return jobs with salary shown upfront. Malayalam & English.';
  return {
    title,
    description,
    keywords: [
      'jobs in kerala',
      'kerala jobs 2026',
      'nursing jobs kerala',
      'IT jobs kerala',
      'kerala psc jobs',
      'gulf return jobs kerala',
      'walk in interview kerala',
      'government jobs kerala',
      'teaching jobs kerala',
    ],
    alternates: { canonical: 'https://ddotsjobs.com' },
    openGraph: {
      title,
      description,
      url: 'https://ddotsjobs.com',
      siteName: 'ddotsjobs.com',
      locale: 'en_IN',
      type: 'website',
    },
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
const LOGO_COLORS = ['#3A9EA5', '#F5C842', '#534AB7', '#1A7F4E', '#C4242B', '#378ADD'];

// District → Malayalam (Unicode, no transliteration).
const DISTRICT_ML: Record<string, string> = {
  thiruvananthapuram: 'തിരുവനന്തപുരം',
  kollam: 'കൊല്ലം',
  pathanamthitta: 'പത്തനംതിട്ട',
  alappuzha: 'ആലപ്പുഴ',
  kottayam: 'കോട്ടയം',
  idukki: 'ഇടുക്കി',
  ernakulam: 'എറണാകുളം',
  thrissur: 'തൃശ്ശൂർ',
  palakkad: 'പാലക്കാട്',
  malappuram: 'മലപ്പുറം',
  kozhikode: 'കോഴിക്കോട്',
  wayanad: 'വയനാട്',
  kannur: 'കണ്ണൂർ',
  kasaragod: 'കാസർഗോഡ്',
};
function districtLabel(d: string | null): string {
  if (!d) return '';
  const ml = DISTRICT_ML[d];
  return ml ? `${titleCase(d)} · ${ml}` : titleCase(d);
}

// Per-sector brand accent (Ddotsmedia 4-color system).
const SECTOR_COLORS: Record<string, string> = {
  nursing: '#E8623A',
  it: '#3A9EA5',
  teaching: '#8DC63F',
  government: '#3A9EA5',
  gulf_return: '#F5C842',
  banking: '#3A9EA5',
  construction: '#E8623A',
  retail: '#8DC63F',
};

function rupee(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

// Card salary: explicit "not disclosed" text rather than hiding it.
function salaryLabel(j: LatestJob): string {
  if (!j.salaryDisclosed) return 'Salary not disclosed';
  if (j.salaryMinPaise != null && j.salaryMaxPaise != null) return `${rupee(j.salaryMinPaise)}–${rupee(j.salaryMaxPaise)}/mo`;
  if (j.salaryMinPaise != null) return `${rupee(j.salaryMinPaise)}/mo`;
  return 'Salary not disclosed';
}

function isNew(d: Date | null): boolean {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() < 24 * 60 * 60 * 1000;
}

// Human-readable employer type (shown under company name).
const EMPLOYER_TYPE_LABELS: Record<string, string> = {
  hospital: 'Multi-specialty hospital',
  clinic: 'Clinic',
  it_company: 'IT company',
  school: 'Educational institution',
  college: 'Educational institution',
  bank: 'Bank / NBFC',
  retail: 'Retail chain',
  construction: 'Construction firm',
  consultancy: 'Recruitment consultancy',
  gulf_agency: 'Overseas recruitment agency',
  government: 'Government body',
};
function employerTypeLabel(code: string | null): string {
  if (!code) return '';
  return EMPLOYER_TYPE_LABELS[code] ?? '';
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

  const catLabel = (slug: string | null): string =>
    SECTORS.find((sec) => sec.slug === slug)?.label ?? (slug ? titleCase(slug) : '');

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'ddotsjobs.com',
      url: 'https://ddotsjobs.com',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://ddotsjobs.com/jobs?q={query}' },
        'query-input': 'required name=query',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Ddotsmedia IT Solutions',
      url: 'https://ddotsjobs.com',
      logo: 'https://ddotsjobs.com/logo.svg',
      sameAs: ['https://ddotsmedia.com', 'https://ddotsmediajobs.com'],
      address: { '@type': 'PostalAddress', addressCountry: 'AE', addressRegion: 'Sharjah' },
    },
  ];

  return (
    <main style={s.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* ── Hero ── */}
      <section style={s.hero}>
        <div style={s.container}>
          <p style={s.kicker}>Kerala&rsquo;s career platform</p>
          <h1 style={s.headline}>Kerala&rsquo;s jobs, beautifully found</h1>
          <p style={s.subtext}>
            Salary shown upfront. No middlemen. No fake jobs. Just real Kerala employers.
          </p>
          <p style={s.subtextMl}>കേരളത്തിലെ verified jobs — salary upfront, no middlemen</p>
          <SearchHero />
          <p style={s.socialProof}>📱 12 employers posting today · 🔔 4 new jobs in the last hour</p>
        </div>
      </section>

      {/* ── Stats strip (animated) ── */}
      <section style={s.container}>
        <StatsStrip stats={stats} />
      </section>

      {/* ── Sector grid ── */}
      <section className="hp-section" style={s.container}>
        <p style={s.eyebrow}>Explore</p>
        <h2 style={s.h2}>Browse by sector</h2>
        <div style={s.sectorGrid}>
          {SECTORS.map((sec) => {
            const n = sectorCounts[sec.slug] ?? 0;
            return (
              <Link key={sec.slug} href={`/jobs?category=${sec.slug}`} className="hp-sector" style={s.sectorCard}>
                <span style={{ ...s.sectorIcon, background: `${SECTOR_COLORS[sec.slug] ?? '#3A9EA5'}1A` }} aria-hidden>{SECTOR_ICONS[sec.slug] ?? '📌'}</span>
                <span style={s.sectorLabel}>{sec.label}</span>
                {n > 0 ? (
                  <span style={{ ...s.sectorCount, color: SECTOR_COLORS[sec.slug] ?? '#3A9EA5' }}>{n.toLocaleString('en-IN')} jobs</span>
                ) : (
                  <span style={s.sectorSoon}>Coming soon</span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Latest jobs ── */}
      <section className="hp-section" style={s.container}>
        <p style={s.eyebrow}>Fresh</p>
        <h2 style={s.h2}>Latest jobs</h2>

        {/* Filter tabs */}
        <div style={s.tabs}>
          <Link href="/jobs" style={{ ...s.tab, ...s.tabActive }}>All Jobs</Link>
          <Link href="/jobs?type=walk_in" style={s.tab}>Walk-in</Link>
          <Link href="/gulf-return" style={s.tab}>Gulf Return</Link>
          <Link href="/jobs?category=government" style={s.tab}>Government</Link>
          <Link href="/jobs" style={s.tab}>Latest</Link>
        </div>

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
          <>
            <div style={s.jobList}>
              {latest.map((j: LatestJob, i: number) => {
                const cat = catLabel(j.categorySlug);
                const catColor = SECTOR_COLORS[j.categorySlug ?? ''] ?? '#3A9EA5';
                return (
                  <Link key={j.id} href={`/jobs/${j.slug ?? j.id}`} className="hp-job" style={s.jobCard}>
                    <div style={{ ...s.logo, background: logoColor(i) }} aria-hidden>
                      {companyInitials(j.company)}
                    </div>
                    <div style={s.jobBody}>
                      <div style={s.jobTop}>
                        <span style={s.jobTitle}>{j.titleEn}</span>
                        <span style={s.jobTime}>{relativeTime(j.publishedAt)}</span>
                      </div>
                      <span style={s.jobCompany}>
                        {j.company}
                        {employerTypeLabel(j.employerTypeCode) && (
                          <span style={s.jobEmpType}> · {employerTypeLabel(j.employerTypeCode)}</span>
                        )}
                      </span>
                      <div style={s.jobMeta}>
                        {isNew(j.publishedAt) && <span style={s.newBadge}>New</span>}
                        {j.isWalkIn && <span style={s.walkBadge}>Walk-in · നേരിട്ട് apply ചെയ്യാം</span>}
                        {cat && <span style={{ ...s.catChip, color: catColor, background: `${catColor}1A` }}>{cat}</span>}
                        {j.district && <span style={s.jobDistrict}>{districtLabel(j.district)}</span>}
                        <span style={s.jobSalary}>{salaryLabel(j)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Link href="/jobs" style={s.viewAll}>
              View all {stats.activeJobs.toLocaleString('en-IN')} jobs →
            </Link>
          </>
        )}
      </section>

      {/* ── WhatsApp CTA (full-width dark teal) ── */}
      <WhatsappCta />

      {/* ── Footer (dark, 4 columns) ── */}
      <footer style={s.footer}>
        <div style={{ ...s.container, ...s.footerGrid }}>
          <div style={s.fcol}>
            <Logo size="sm" variant="white" showText href="/" />
            <p style={s.ftaglineMl}>കേരളത്തിന്റെ തൊഴിൽ പോർട്ടൽ</p>
            <p style={s.ftagline}>
              Ddotsmedia IT Solutions LLC<br />
              SHAMS Free Zone, Sharjah, UAE
            </p>
            <p style={s.faddr}>
              <a href="https://wa.me/971509379212" style={s.flink}>WhatsApp: +971 50 937 9212</a>
              <br />
              <a href="mailto:info@ddotsmedia.com" style={s.flink}>info@ddotsmedia.com</a>
            </p>
            <div style={s.social}>
              <a href="https://wa.me/971509379212" style={s.socialLink} aria-label="WhatsApp">💬</a>
              <a href="https://linkedin.com/" style={s.socialLink} aria-label="LinkedIn">in</a>
              <a href="https://youtube.com/" style={s.socialLink} aria-label="YouTube (Vaidya Sala)">▶</a>
            </div>
          </div>

          <div style={s.fcol}>
            <p style={s.fhead}>For Jobseekers</p>
            <Link href="/jobs" style={s.flink}>Browse Jobs</Link>
            <Link href="/login" style={s.flink}>Create Account</Link>
            <Link href="/seeker/alerts" style={s.flink}>Job Alerts</Link>
            <Link href="/psc" style={s.flink}>PSC Tracker</Link>
            <Link href="/gulf-return" style={s.flink}>Gulf Return Hub</Link>
            <Link href="/technopark-jobs" style={s.flink}>IT Park Jobs</Link>
            <Link href="/jobs?type=walk_in" style={s.flink}>Walk-in Jobs</Link>
          </div>

          <div style={s.fcol}>
            <p style={s.fhead}>For Employers</p>
            <Link href="/employer/register" style={s.flink}>Post a Job</Link>
            <Link href="/employer/dashboard" style={s.flink}>Employer Dashboard</Link>
            <Link href="/employer/talent" style={s.flink}>Talent Pool</Link>
            <Link href="/employer/profile" style={s.flink}>Company Profile</Link>
            <Link href="/employer/billing" style={s.flink}>Pricing Plans</Link>
          </div>

          <div style={s.fcol}>
            <p style={s.fhead}>Top Districts</p>
            {[
              ['ernakulam', 'Ernakulam'],
              ['thiruvananthapuram', 'Thiruvananthapuram'],
              ['kozhikode', 'Kozhikode'],
              ['thrissur', 'Thrissur'],
              ['malappuram', 'Malappuram'],
              ['kannur', 'Kannur'],
            ].map(([v, label]) => (
              <Link key={v} href={`/jobs?district=${v}`} style={s.flink}>Jobs in {label}</Link>
            ))}
          </div>
        </div>

        <div style={s.footerBar}>
          <div style={{ ...s.container, ...s.footerBarInner }}>
            <span>© 2026 ddotsjobs.com</span>
            <nav style={s.barLinks}>
              <Link href="/about" style={s.barLink}>About</Link>
              <Link href="/privacy" style={s.barLink}>Privacy</Link>
              <Link href="/terms" style={s.barLink}>Terms</Link>
              <Link href="/sitemap.xml" style={s.barLink}>Sitemap</Link>
            </nav>
          </div>
        </div>
      </footer>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh' },
  container: { width: '100%', maxWidth: 1040, margin: '0 auto', padding: '0 var(--space-2)' },
  hero: {
    padding: 'clamp(48px, 9vw, 80px) 0',
    background: 'linear-gradient(160deg, #F0F9FA 0%, #FFFFFF 50%, #F8FDF0 100%)',
  },
  kicker: {
    display: 'inline-block',
    borderLeft: '2px solid #F5C842',
    paddingLeft: 10,
    margin: '0 0 var(--space-2)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#3A9EA5',
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
  subtextMl: { fontSize: 14, color: '#6B6860', margin: '0 0 var(--space-3)' },
  socialProof: { fontSize: 13, color: '#6B6860', margin: 'var(--space-2) 0 0' },
  sectorSoon: { fontSize: 13, fontWeight: 600, color: '#B0AD9F' },
  jobEmpType: { color: '#B0AD9F' },
  faddr: { fontSize: 13, color: '#9a9a92', lineHeight: 1.6, margin: 0 },
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
    color: '#F5C842',
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
  sectorIcon: { fontSize: 24, lineHeight: 1, width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  sectorLabel: { fontSize: 15, fontWeight: 600, color: 'var(--color-dark)' },
  sectorCount: { fontSize: 13, fontWeight: 600, color: '#3A9EA5' },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 var(--space-2)' },
  tab: { fontSize: 13, fontWeight: 600, color: '#6B6860', background: '#fff', border: '1px solid #E8E6DF', padding: '7px 16px', borderRadius: 999, minHeight: 36, display: 'inline-flex', alignItems: 'center' },
  tabActive: { color: '#1A1916', background: 'rgba(58,158,165,0.12)', borderColor: 'rgba(58,158,165,0.35)' },
  jobList: { display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', overflow: 'hidden' },
  jobCard: {
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'flex-start',
    padding: 'var(--space-2)',
    background: '#fff',
    borderBottom: '1px solid #f1f1ec',
  },
  logo: {
    flex: '0 0 48px',
    width: 48,
    height: 48,
    borderRadius: '9999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 600,
    fontSize: 16,
  },
  jobBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  jobTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  jobTitle: { fontSize: 16, fontWeight: 600, color: '#1A1916' },
  jobTime: { fontSize: 12, color: '#B0AD9F', whiteSpace: 'nowrap' },
  jobCompany: { fontSize: 14, color: '#6B6860' },
  jobMeta: { display: 'flex', gap: 'var(--space-1)', alignItems: 'center', flexWrap: 'wrap' },
  jobSalary: { fontSize: 14, fontWeight: 600, color: '#3A9EA5' },
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
  newBadge: { fontSize: 11, fontWeight: 700, color: '#fff', background: '#8DC63F', padding: '2px 8px', borderRadius: 'var(--radius-pill)' },
  walkBadge: { fontSize: 11, fontWeight: 700, color: '#1A1916', background: 'rgba(245,200,66,0.25)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' },
  catChip: { fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  viewAll: { display: 'inline-block', marginTop: 'var(--space-2)', fontSize: 14, fontWeight: 700, color: '#3A9EA5' },
  // Dark footer.
  footer: { background: '#0F0E0C', color: '#F0EFE8', marginTop: 0 },
  footerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 'var(--space-3)',
    paddingTop: 'var(--space-5)',
    paddingBottom: 'var(--space-4)',
  },
  fcol: { display: 'flex', flexDirection: 'column', gap: 10 },
  ftaglineMl: { fontSize: 14, color: '#c7c5bd', margin: '2px 0 0' },
  ftagline: { fontSize: 13, color: '#9a9a92', lineHeight: 1.5, margin: 0 },
  social: { display: 'flex', gap: 12, marginTop: 4, fontSize: 18 },
  socialLink: { textDecoration: 'none' },
  fhead: { fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F5C842', margin: '0 0 2px' },
  flink: { fontSize: 14, color: '#c7c5bd' },
  footerBar: { borderTop: '1px solid rgba(255,255,255,0.1)' },
  footerBarInner: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 'var(--space-2)',
    paddingBottom: 'var(--space-2)',
    fontSize: 12,
    color: '#9a9a92',
  },
  barLinks: { display: 'flex', gap: 'var(--space-2)' },
  barLink: { fontSize: 12, color: '#9a9a92' },
};
