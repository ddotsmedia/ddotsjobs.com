'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

// Read-only view of the endorsements the current seeker has received, shown on
// their own profile, with a link to their shareable public profile.
export function ReceivedEndorsements({ userId }: { userId: string }) {
  const q = trpc.endorsement.getUserSkillEndorsements.useQuery({ userId });
  const rows = q.data ?? [];

  return (
    <section style={s.section}>
      <div style={s.head}>
        <h2 style={s.h2}>Skill endorsements</h2>
        <Link href={`/profile/${userId}`} style={s.link}>Public profile →</Link>
      </div>
      {q.isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={s.muted}>No endorsements yet. Share your public profile to get endorsed by peers.</p>
      ) : (
        <div style={s.grid}>
          {rows.map((r) => (
            <span key={r.skillName} style={s.chip}>
              {r.skillName}
              <span style={s.count}>{r.count}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  section: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
  h2: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  link: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
  muted: { fontSize: 14, color: '#8a8a83', margin: 0 },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#eef6f5', border: '1px solid #d6ebe9', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, color: '#2a2a26' },
  count: { minWidth: 22, height: 22, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--color-accent)', borderRadius: 999 },
};
