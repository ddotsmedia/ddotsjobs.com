import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerTrpc } from '@/lib/trpc/server';
import { EmployerSidebar } from '@/components/employer/EmployerSidebar';
import { EmployerMetrics } from '@/components/employer/EmployerMetrics';
import { ApplicantPipeline } from '@/components/employer/ApplicantPipeline';
import { daysUntil, formatDate, relativeTime, rupeesPerMonth, titleCase } from '@/lib/format';

export const metadata: Metadata = { title: 'Employer dashboard — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

const POST_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#1d7a3a', bg: '#e6f5ea' },
  pending_review: { label: 'Pending', color: '#9a6b00', bg: '#fdf0d5' },
  closed: { label: 'Closed', color: '#6b6b66', bg: '#f1f1ec' },
  rejected: { label: 'Rejected', color: '#c0392b', bg: '#fdecea' },
};

export default async function EmployerDashboardPage() {
  const trpc = await getServerTrpc();

  let profile: Awaited<ReturnType<typeof trpc.employer.getProfile>> = null;
  try {
    profile = await trpc.employer.getProfile();
  } catch {
    profile = null;
  }
  if (!profile) redirect('/employer/register');

  const [posts, walkIn, sub, waLog] = await Promise.all([
    trpc.employerDashboard.jobPosts(),
    trpc.employerDashboard.nextWalkIn(),
    trpc.employerDashboard.subscription(),
    trpc.employerDashboard.waPushLog(),
  ]);

  const verified = profile.verificationStatus === 'verified';
  const nearLimit = sub.jobsPosted >= sub.jobsLimit - 1;

  return (
    <div style={s.shell}>
      <EmployerSidebar company={profile.companyName ?? ''} verified={verified} />

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <p style={s.date}>{formatDate(new Date())}</p>
            <h1 style={s.title}>Employer dashboard</h1>
          </div>
          <Link href="/employer/jobs/new" style={s.postBtn}>Post a job</Link>
        </header>

        <EmployerMetrics />

        {/* Walk-in widget */}
        {walkIn && (
          <section style={s.walkCard}>
            <div>
              <p style={s.walkTitle}>Upcoming walk-in: {walkIn.title}</p>
              <p style={s.walkMeta}>{formatDate(walkIn.startsAt)} · {walkIn.venueEn}</p>
              <p style={s.walkStats}>{walkIn.registrations} registrations · {walkIn.knmcVerified} KNMC verified</p>
            </div>
            <Link href="/employer/walkin/notice" style={s.noticeBtn}>Generate Malayalam notice</Link>
          </section>
        )}

        {/* Subscription bar */}
        {nearLimit && (
          <section style={s.subBar}>
            <div style={s.subTop}>
              <span>{sub.jobsPosted} of {sub.jobsLimit} posts used</span>
              <Link href="/employer/billing" style={s.upgrade}>Upgrade</Link>
            </div>
            <div style={s.track}><div style={{ ...s.fill, width: `${Math.min(100, (sub.jobsPosted / sub.jobsLimit) * 100)}%` }} /></div>
          </section>
        )}

        <div style={s.columns}>
          {/* Left */}
          <div style={s.colLeft}>
            <ApplicantPipeline />

            <section style={s.card}>
              <div style={s.cardHead}>
                <h2 style={s.h2}>Active posts</h2>
                <Link href="/employer/jobs" style={s.viewAll}>Manage all →</Link>
              </div>
              {posts.length === 0 ? (
                <div style={s.empty}>No job posts yet. <Link href="/employer/jobs/new" style={s.link}>Post a job →</Link></div>
              ) : (
                <div style={s.rows}>
                  {posts.map((j) => {
                    const ui = POST_STATUS[j.status] ?? POST_STATUS.closed!;
                    const days = j.validThrough ? daysUntil(j.validThrough) : null;
                    const soon = days != null && days >= 0 && days <= 3;
                    return (
                      <div key={j.id} style={s.postRow}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/jobs/${j.slug ?? j.id}`} style={s.postTitle}>{j.title}</Link>
                          <div style={s.postMeta}>
                            <span style={s.muted}>{j.district ? titleCase(j.district) : '—'}</span>
                            <span style={s.salary}>· {rupeesPerMonth(j.salaryMinPaise, j.salaryDisclosed)}</span>
                          </div>
                          <div style={s.postStats}>
                            <span>{j.viewCount} views</span>
                            <span>· {j.applicationCount} applied</span>
                            <span>· {j.shortlistCount} shortlisted</span>
                            {j.isWalkIn && <span style={s.walkBadge}>Walk-in</span>}
                          </div>
                        </div>
                        <div style={s.postRight}>
                          <span style={{ ...s.badge, color: ui.color, background: ui.bg }}>{ui.label}</span>
                          {soon && <span style={s.closing}>Closing soon</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right */}
          <div style={s.colRight}>
            <section style={s.card}>
              <h2 style={s.h2}>WhatsApp pushes</h2>
              {waLog.length === 0 ? (
                <div style={s.empty}>No pushes sent yet.</div>
              ) : (
                <div style={s.rows}>
                  {waLog.slice(0, 8).map((w, i) => (
                    <div key={i} style={s.waRow}>
                      <span style={{ ...s.dot, background: w.deliveryStatus === 'sent' ? '#1d7a3a' : '#b0ad9f' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={s.waText}>{w.batchCount} candidates notified — {w.title}</span>
                        <span style={s.muted}>{relativeTime(w.dispatchedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={s.card}>
              <h2 style={s.h2}>Talent pool</h2>
              {!sub.features.talentPoolAccess ? (
                <div style={s.locked}>
                  <p style={{ fontWeight: 600 }}>🔒 Search 96K+ verified candidates</p>
                  <p style={s.muted}>Upgrade to access the talent pool.</p>
                  <Link href="/employer/billing" style={s.upgradeBtn}>Upgrade plan</Link>
                </div>
              ) : (
                <p style={s.muted}>Talent search coming soon.</p>
              )}
            </section>

            <section style={s.card}>
              <h2 style={s.h2}>Subscription</h2>
              <p style={s.tier}>{titleCase(sub.tier)} plan</p>
              <div style={s.track}><div style={{ ...s.fill, width: `${Math.min(100, (sub.jobsPosted / sub.jobsLimit) * 100)}%` }} /></div>
              <p style={s.muted}>{sub.jobsPosted} of {sub.jobsLimit} job posts used</p>
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
  postBtn: { padding: '10px 18px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)', height: 'fit-content' },
  walkCard: { display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap', padding: 'var(--space-3)', background: '#fdf3da', border: '1px solid #f0d999', borderRadius: 'var(--radius-card)' },
  walkTitle: { fontSize: 16, fontWeight: 700, margin: 0 },
  walkMeta: { fontSize: 13, color: '#9a6b00', margin: '2px 0 0' },
  walkStats: { fontSize: 13, color: '#55554f', margin: '2px 0 0' },
  noticeBtn: { padding: '10px 16px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  subBar: { padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', display: 'flex', flexDirection: 'column', gap: 8 },
  subTop: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#55554f' },
  upgrade: { color: 'var(--color-accent)', fontWeight: 600 },
  track: { height: 8, background: '#ececdf', borderRadius: 999 },
  fill: { height: 8, background: 'var(--color-accent)', borderRadius: 999 },
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
  postRow: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid #f4f4ef' },
  postTitle: { fontSize: 15, fontWeight: 600, color: 'var(--color-dark)' },
  postMeta: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 },
  postStats: { display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 12, color: '#6b6b66', marginTop: 2 },
  postRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  salary: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
  muted: { fontSize: 12, color: '#9a9a92' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', whiteSpace: 'nowrap' },
  closing: { fontSize: 11, fontWeight: 600, color: '#c0392b' },
  walkBadge: { fontSize: 11, color: '#1d7a3a', background: '#e6f5ea', padding: '1px 7px', borderRadius: '9999px' },
  waRow: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: '1px solid #f4f4ef' },
  dot: { width: 8, height: 8, borderRadius: '9999px', marginTop: 6, flex: '0 0 auto' },
  waText: { display: 'block', fontSize: 13, color: 'var(--color-dark)' },
  locked: { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' },
  upgradeBtn: { marginTop: 4, padding: '10px 18px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  tier: { fontSize: 15, fontWeight: 600, margin: '0 0 8px' },
};
