import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerTrpc } from '@/lib/trpc/server';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Most-endorsed skills — ddotsjobs.com',
  description: 'The most peer-endorsed skills across Kerala job seekers on ddotsjobs.com.',
};

export default async function SkillsLeaderboardPage() {
  const trpc = await getServerTrpc();
  const top = await trpc.endorsement.getTopSkills().catch(() => []);
  const max = Math.max(...top.map((t) => t.totalEndorsements), 1);

  return (
    <main style={s.page}>
      <div style={s.container}>
        <p style={s.eyebrow}>Community</p>
        <h1 style={s.h1}>Most-endorsed skills</h1>
        <p style={s.sub}>Skills Kerala job seekers vouch for the most.</p>

        {top.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>No endorsements yet.</p>
            <p style={{ color: '#6b6b66' }}>Endorse a peer’s skills to get the leaderboard started.</p>
            <Link href="/jobs" style={s.browse}>Browse jobs</Link>
          </div>
        ) : (
          <ol style={s.list}>
            {top.map((t, i) => (
              <li key={t.skillName} style={s.row}>
                <span style={s.rank}>{i + 1}</span>
                <div style={s.body}>
                  <div style={s.rowTop}>
                    <span style={s.skill}>{t.skillName}</span>
                    <span style={s.count}>{t.totalEndorsements.toLocaleString('en-IN')} endorsements</span>
                  </div>
                  <div style={s.track}><span style={{ ...s.bar, width: `${Math.max((t.totalEndorsements / max) * 100, 3)}%` }} /></div>
                  <span style={s.people}>{t.userCount} {t.userCount === 1 ? 'person' : 'people'}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 720, margin: '0 auto', padding: 'var(--space-3) var(--space-2)' },
  eyebrow: { borderLeft: '3px solid #F5C842', paddingLeft: 10, margin: '0 0 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B6860' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,5vw,2.4rem)', margin: 0, color: 'var(--color-dark)' },
  sub: { fontSize: 14, color: '#6b6b66', margin: '6px 0 var(--space-3)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'flex', gap: 14, alignItems: 'flex-start', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  rank: { flex: '0 0 auto', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, fontWeight: 800, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: '50%' },
  body: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  rowTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' },
  skill: { fontSize: 16, fontWeight: 700, color: '#1A1916' },
  count: { fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' },
  track: { height: 8, background: '#f1f1ec', borderRadius: 5, overflow: 'hidden' },
  bar: { display: 'block', height: '100%', background: '#3A9EA5', borderRadius: 5 },
  people: { fontSize: 12, color: '#9a9a92' },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0' },
  browse: { display: 'inline-block', marginTop: 8, padding: '10px 24px', fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
};
