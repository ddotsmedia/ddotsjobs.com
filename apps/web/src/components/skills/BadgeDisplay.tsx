'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

// Skills & Badges section for the seeker profile.
export function BadgeDisplay() {
  const q = trpc.assessment.getUserBadges.useQuery();
  const badges = q.data ?? [];

  return (
    <section style={s.section}>
      <div style={s.head}>
        <h2 style={s.h2}>Skills &amp; Badges</h2>
        <Link href="/skills" style={s.link}>Take an assessment →</Link>
      </div>
      {q.isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : badges.length === 0 ? (
        <p style={s.muted}>No badges yet. Pass a skill assessment to earn a verified badge.</p>
      ) : (
        <div style={s.grid}>
          {badges.map((b) => (
            <div key={b.assessmentId} style={s.badge} title={`${b.bestScore}% · earned ${new Date(b.earnedAt).toLocaleDateString('en-IN')}`}>
              <span style={s.icon}>{b.icon ?? '🏆'}</span>
              <div>
                <div style={s.badgeTitle}>{b.title}</div>
                <div style={s.badgeMeta}>{b.bestScore}% · {new Date(b.earnedAt).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  section: { background: '#fff', borderRadius: 'var(--radius-card, 14px)', border: '1px solid #efefe9', padding: 'var(--space-3, 18px)', marginBottom: 'var(--space-2, 12px)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  h2: { fontSize: 16, margin: 0, color: '#1A1916' },
  link: { color: '#3A9EA5', fontSize: 13, fontWeight: 600 },
  muted: { color: '#9a9a92', fontSize: 14, margin: 0 },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  badge: { display: 'flex', alignItems: 'center', gap: 10, background: '#F4F3EE', borderRadius: 12, padding: '10px 14px' },
  icon: { fontSize: 26 },
  badgeTitle: { fontWeight: 700, fontSize: 14, color: '#1A1916' },
  badgeMeta: { fontSize: 12, color: '#6b6860' },
};
