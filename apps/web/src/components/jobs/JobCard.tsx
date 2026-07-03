import Link from 'next/link';
import type { JobListItem } from '@/server/routers/jobs';
import { initials, relativeTime, rupeesPerMonth, titleCase, walkInDateLabel } from '@/lib/format';

export function JobCard({
  job,
  parkBadge,
}: {
  job: JobListItem;
  parkBadge?: { label: string; color: string };
}) {
  const featured = job.viewCount > 50;
  const href = `/jobs/${job.slug ?? job.id}`;

  return (
    <Link
      href={href}
      style={{
        ...s.card,
        borderLeft: featured ? '4px solid var(--color-brand)' : '1px solid #efefe9',
      }}
    >
      <div style={s.row}>
        <div style={s.logo} aria-hidden>
          {initials(job.company)}
        </div>
        <div style={s.body}>
          <div style={s.titleRow}>
            <span style={s.title}>{job.titleEn}</span>
            <span style={s.time}>{relativeTime(job.publishedAt)}</span>
          </div>

          <div style={s.companyRow}>
            <span style={s.company}>{job.company}</span>
            {job.isVerified && (
              <span style={s.verified} title="Verified employer">
                ✓ Verified
              </span>
            )}
            {job.cultureAvg != null && (job.cultureCount ?? 0) >= 3 && (
              <span style={s.culture} title={`${job.cultureCount} reviews`}>★ {job.cultureAvg.toFixed(1)}</span>
            )}
          </div>

          <div style={s.badges}>
            {parkBadge && (
              <span style={{ ...s.badge, background: parkBadge.color, color: '#fff' }}>
                {parkBadge.label}
              </span>
            )}
            {job.district && <span style={s.badge}>{titleCase(job.district)}</span>}
            <span style={s.badge}>{titleCase(job.jobType)}</span>
            {job.isWalkIn && (
              <span style={{ ...s.badge, ...s.walkIn }}>{walkInDateLabel(job.walkInStartsAt)}</span>
            )}
            {job.valuesGulfExperience && (
              <span style={{ ...s.badge, ...s.gulf }}>Gulf Return ✓</span>
            )}
          </div>

          <div style={s.footer}>
            <span style={s.salary}>{rupeesPerMonth(job.salaryMinPaise, job.salaryDisclosed)}</span>
            <span style={s.apply}>Apply →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    display: 'block',
    padding: 'var(--space-2)',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    border: '1px solid #efefe9',
  },
  row: { display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' },
  logo: {
    flex: '0 0 auto',
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--color-accent)',
    background: '#eef6f5',
    borderRadius: 12,
  },
  body: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  titleRow: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  title: { fontSize: 16, fontWeight: 500, color: 'var(--color-dark)' },
  time: { fontSize: 12, color: '#9a9a92', whiteSpace: 'nowrap' },
  companyRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  company: { fontSize: 14, color: '#55554f' },
  verified: { fontSize: 12, fontWeight: 600, color: 'var(--color-accent)' },
  culture: { fontSize: 12, fontWeight: 700, color: '#3A9EA5', background: 'rgba(58,158,165,0.12)', borderRadius: 999, padding: '1px 8px' },
  badges: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  badge: {
    fontSize: 12,
    color: '#55554f',
    background: '#f1f1ec',
    padding: '3px 10px',
    borderRadius: 'var(--radius-pill)',
  },
  walkIn: { background: '#e6f5ea', color: '#1d7a3a' },
  gulf: { background: '#fdf0d5', color: '#9a6b00' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  salary: { fontSize: 15, fontWeight: 600, color: 'var(--color-accent)' },
  apply: { fontSize: 14, fontWeight: 600, color: 'var(--color-brand)' },
};
