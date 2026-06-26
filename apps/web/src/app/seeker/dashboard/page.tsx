import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerTrpc } from '@/lib/trpc/server';
import { SeekerSidebar } from '@/components/seeker/SeekerSidebar';
import { FitScoreRing } from '@/components/FitScoreRing';
import { CompletionRing } from '@/components/seeker/CompletionRing';
import { formatDate, initials, relativeTime, rupeesPerMonth, titleCase } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

const STATUS_UI: Record<string, { label: string; color: string; bg: string }> = {
  applied: { label: 'Applied', color: '#9a6b00', bg: '#fdf0d5' },
  under_review: { label: 'Under review', color: '#2a4d9b', bg: '#e8eefc' },
  shortlisted: { label: 'Shortlisted', color: '#1d7a3a', bg: '#e6f5ea' },
  interview_scheduled: { label: 'Interview', color: '#534ab7', bg: '#eceafa' },
  interviewed: { label: 'Interviewed', color: '#534ab7', bg: '#eceafa' },
  offer_made: { label: 'Offer', color: '#1d7a3a', bg: '#e6f5ea' },
  rejected: { label: 'Rejected', color: '#c0392b', bg: '#fdecea' },
};

const BADGE_UI: Record<string, { label: string; color: string }> = {
  verified: { label: '✓ Verified', color: '#1d7a3a' },
  pending: { label: 'Pending', color: '#9a6b00' },
  failed: { label: 'Failed', color: '#c0392b' },
  manual_review: { label: 'In review', color: '#9a6b00' },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function SeekerDashboardPage() {
  const trpc = await getServerTrpc();
  const [metrics, recentApps, recommended, recentAlerts, completion, badges, profile] = await Promise.all([
    trpc.seekerDashboard.metrics(),
    trpc.seekerDashboard.recentApplications(),
    trpc.seekerDashboard.recommendedJobs(),
    trpc.seekerDashboard.recentAlerts(),
    trpc.seekerDashboard.profileCompletion(),
    trpc.verification.myBadges(),
    trpc.seeker.getProfile().catch(() => null),
  ]);

  const fullName = profile?.fullName ?? '';
  const firstName = fullName.split(' ')[0] || 'there';

  const metricCards = [
    { label: 'Employers viewed profile', value: String(metrics.profileViewsThisWeek) },
    { label: 'Applications sent', value: String(metrics.applicationsSent) },
    { label: 'Avg fit score', value: metrics.avgFitScore != null ? String(metrics.avgFitScore) : '—' },
    { label: 'New alerts today', value: String(metrics.newAlertsToday) },
  ];

  return (
    <div style={s.shell}>
      <SeekerSidebar name={fullName} />

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <p style={s.date}>{formatDate(new Date())}</p>
            <h1 style={s.title}>{greeting()}, {firstName}.</h1>
          </div>
          <Link href="/jobs" style={s.findBtn}>Find jobs</Link>
        </header>

        {/* Metrics */}
        <div style={s.metricGrid}>
          {metricCards.map((m) => (
            <div key={m.label} style={s.metricCard}>
              <span style={s.metricValue}>{m.value}</span>
              <span style={s.metricLabel}>{m.label}</span>
            </div>
          ))}
        </div>

        <div style={s.columns}>
          {/* Left */}
          <div style={s.colLeft}>
            <section style={s.card}>
              <div style={s.cardHead}>
                <h2 style={s.h2}>Recent applications</h2>
                <Link href="/seeker/applications" style={s.viewAll}>View all →</Link>
              </div>
              {recentApps.length === 0 ? (
                <div style={s.empty}>No applications yet. <Link href="/jobs" style={s.link}>Browse open jobs →</Link></div>
              ) : (
                <div style={s.rows}>
                  {recentApps.map((a) => {
                    const ui = STATUS_UI[a.statusCode] ?? STATUS_UI.applied!;
                    return (
                      <div key={a.id} style={s.appRow}>
                        <span style={s.logo} aria-hidden>{initials(a.company)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/jobs/${a.slug ?? a.id}`} style={s.appTitle}>{a.title}</Link>
                          <div style={s.appMeta}>
                            <span style={{ ...s.badge, color: ui.color, background: ui.bg }}>{ui.label}</span>
                            <span style={s.muted}>{relativeTime(a.createdAt)}</span>
                          </div>
                          {a.interviewScheduledAt && (
                            <span style={s.interview}>Interview: {new Date(a.interviewScheduledAt).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                        {a.fitScoreAtApply != null && <FitScoreRing score={a.fitScoreAtApply} size="sm" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={s.card}>
              <div style={s.cardHead}>
                <h2 style={s.h2}>Recommended for you</h2>
                <Link href="/jobs" style={s.viewAll}>See all →</Link>
              </div>
              {recommended.length === 0 ? (
                <div style={s.empty}>Complete your profile to get personalized recommendations.</div>
              ) : (
                <div style={s.rows}>
                  {recommended.map((j) => (
                    <div key={j.id} style={s.recRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/jobs/${j.slug ?? j.id}`} style={s.appTitle}>{j.title}</Link>
                        <div style={s.appMeta}>
                          <span style={s.muted}>{j.company}{j.district ? ` · ${titleCase(j.district)}` : ''}</span>
                        </div>
                        <div style={s.appMeta}>
                          <span style={s.salary}>{rupeesPerMonth(j.salaryMinPaise, j.salaryDisclosed)}</span>
                          {j.overallScore != null && <span style={s.fitPct}>{j.overallScore}% fit</span>}
                        </div>
                      </div>
                      <Link href={`/seeker/jobs/${j.slug ?? j.id}/apply`} style={s.applyBtn}>Apply</Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right */}
          <div style={s.colRight}>
            <section style={s.card}>
              <h2 style={s.h2}>Profile completion</h2>
              <div style={s.ringWrap}><CompletionRing pct={completion.pct} /></div>
              <div style={s.checklist}>
                {completion.checklist.map((c) =>
                  c.done ? (
                    <span key={c.item} style={s.checkDone}>✓ {c.item}</span>
                  ) : (
                    <Link key={c.item} href={c.link} style={s.checkPending}>→ {c.item}</Link>
                  ),
                )}
              </div>
              {completion.pct < 80 && <Link href="/seeker/profile/setup" style={s.cta}>Complete profile</Link>}
            </section>

            <section style={s.card}>
              <div style={s.cardHead}>
                <h2 style={s.h2}>WhatsApp alerts</h2>
                <Link href="/seeker/alerts" style={s.viewAll}>Manage →</Link>
              </div>
              {recentAlerts.length === 0 ? (
                <div style={s.empty}>No alerts yet. <Link href="/seeker/alerts" style={s.link}>Set up WhatsApp alerts →</Link></div>
              ) : (
                <div style={s.rows}>
                  {recentAlerts.slice(0, 3).map((al, i) => (
                    <div key={i} style={s.alertRow}>
                      <span style={{ ...s.dot, background: al.deliveryStatus === 'sent' ? '#1d7a3a' : '#b0ad9f' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/jobs/${al.slug}`} style={s.alertTitle}>{al.title}</Link>
                        <span style={s.muted}>{al.company} · {relativeTime(al.dispatchedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={s.card}>
              <div style={s.cardHead}>
                <h2 style={s.h2}>Your verified badges</h2>
                <Link href="/seeker/profile/verify" style={s.viewAll}>Add →</Link>
              </div>
              {badges.length === 0 ? (
                <div style={s.empty}>No badges yet. <Link href="/seeker/profile/verify" style={s.link}>Verify a credential →</Link></div>
              ) : (
                <div style={s.rows}>
                  {badges.map((b) => {
                    const ui = BADGE_UI[b.statusCode] ?? BADGE_UI.pending!;
                    return (
                      <div key={b.typeCode} style={s.badgeRow}>
                        <span>{b.typeCode}</span>
                        <span style={{ color: ui.color, fontWeight: 600, fontSize: 13 }}>{ui.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', alignItems: 'flex-start', background: 'var(--color-neutral)', minHeight: '100dvh' },
  main: { flex: 1, minWidth: 0, padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: 1100 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)', flexWrap: 'wrap' },
  date: { fontSize: 13, color: '#9a9a92', margin: 0 },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.6rem,5vw,2.2rem)', margin: '2px 0 0' },
  findBtn: { padding: '10px 18px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)', height: 'fit-content' },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-1)' },
  metricCard: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  metricValue: { fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-accent)' },
  metricLabel: { fontSize: 12, color: '#6b6b66' },
  columns: { display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', flexWrap: 'wrap' },
  colLeft: { flex: '2 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  colRight: { flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  card: { padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', margin: 0 },
  viewAll: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
  rows: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  empty: { padding: 'var(--space-2)', fontSize: 14, color: '#6b6b66' },
  link: { color: 'var(--color-accent)', fontWeight: 600 },
  appRow: { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f4f4ef' },
  logo: { width: 38, height: 38, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: 10 },
  appTitle: { fontSize: 14, fontWeight: 600, color: 'var(--color-dark)' },
  appMeta: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: '9999px' },
  muted: { fontSize: 12, color: '#9a9a92' },
  interview: { display: 'block', fontSize: 12, color: '#534ab7', fontWeight: 600, marginTop: 2 },
  recRow: { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f4f4ef' },
  salary: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
  fitPct: { fontSize: 12, fontWeight: 600, color: '#9a6b00' },
  applyBtn: { flex: '0 0 auto', padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  ringWrap: { display: 'flex', justifyContent: 'center', padding: 'var(--space-1) 0' },
  checklist: { display: 'flex', flexDirection: 'column', gap: 4 },
  checkDone: { fontSize: 13, color: '#1d7a3a' },
  checkPending: { fontSize: 13, color: '#9a6b00' },
  cta: { display: 'block', textAlign: 'center', marginTop: 'var(--space-1)', padding: '10px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  alertRow: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: '1px solid #f4f4ef' },
  dot: { width: 8, height: 8, borderRadius: '9999px', marginTop: 6, flex: '0 0 auto' },
  alertTitle: { display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-dark)' },
  badgeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #f4f4ef', fontSize: 14 },
};
