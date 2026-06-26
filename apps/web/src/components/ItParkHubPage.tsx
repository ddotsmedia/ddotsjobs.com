import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';
import { ParkJobResults } from '@/components/itpark/ParkJobResults';
import { PARK_BADGE } from '@/lib/constants';
import { titleCase } from '@/lib/format';

type Park = inferRouterOutputs<AppRouter>['itParks']['getBySlug'];
type Jobs = inferRouterOutputs<AppRouter>['itParks']['jobs'];

export function ItParkHubPage({ park, jobs }: { park: Park; jobs: Jobs }) {
  const badge = PARK_BADGE[park.slug] ?? { label: park.name, color: '#3A9EA5' };

  return (
    <main style={s.page}>
      {/* Hero */}
      <section style={{ ...s.hero, borderTop: `4px solid ${badge.color}` }}>
        <div style={s.container}>
          <span style={{ ...s.badge, background: badge.color }}>{badge.label}</span>
          <h1 style={s.name}>{park.name}</h1>
          <p style={s.location}>
            {park.city} · {titleCase(park.district)}
          </p>
          {park.description && <p style={s.desc}>{park.description}</p>}
          <div style={s.stats}>
            <Stat value={(park.totalCompanies ?? 0).toLocaleString('en-IN')} label="companies" />
            <Stat value={(park.totalEmployees ?? 0).toLocaleString('en-IN')} label="professionals" />
            <Stat value={(park.activeJobsCount ?? 0).toLocaleString('en-IN')} label="active jobs" />
          </div>
          {park.websiteUrl && (
            <a href={park.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" style={s.site}>
              {park.websiteUrl.replace(/^https?:\/\//, '')} ↗
            </a>
          )}
        </div>
      </section>

      {/* Jobs */}
      <section style={s.container}>
        <h2 style={s.h2}>Jobs at {park.name}</h2>
        <ParkJobResults
          slug={park.slug}
          parkName={park.name}
          parkBadge={badge}
          initialItems={jobs.items}
          initialCursor={jobs.nextCursor}
        />
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
  container: { width: '100%', maxWidth: 940, margin: '0 auto', padding: '0 var(--space-2)' },
  hero: { padding: 'var(--space-4) 0 var(--space-3)', background: '#fff', marginBottom: 'var(--space-3)' },
  badge: { display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#fff', padding: '4px 12px', borderRadius: 'var(--radius-pill)' },
  name: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(2.2rem,8vw,3.6rem)', lineHeight: 1.05, margin: 'var(--space-1) 0 4px', color: 'var(--color-dark)' },
  location: { fontSize: 16, color: '#55554f', margin: 0 },
  desc: { fontSize: 15, color: '#55554f', margin: 'var(--space-1) 0 0', maxWidth: 640 },
  stats: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' },
  statCard: { display: 'flex', flexDirection: 'column' },
  statValue: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-accent)' },
  statLabel: { fontSize: 13, color: '#6b6b66' },
  site: { display: 'inline-block', marginTop: 'var(--space-2)', fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem', margin: '0 0 var(--space-2)' },
};
