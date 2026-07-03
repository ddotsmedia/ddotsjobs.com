'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

export function SkillsList({ authed }: { authed: boolean }) {
  const q = trpc.assessment.getAssessments.useQuery();
  const items = q.data ?? [];

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header>
          <h1 style={s.h1}>Skill Assessments</h1>
          <p style={s.sub}>Take a short quiz, earn a verified badge on your profile. Employers can see your badges.</p>
        </header>
        {!authed && (
          <div style={s.nudge}><Link href="/login?next=/skills" style={s.link}>Sign in</Link> to take assessments and earn badges.</div>
        )}
        {q.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : (
          <div style={s.grid}>
            {items.map((a) => (
              <div key={a.id} style={s.card}>
                <div style={s.cardTop}>
                  <span style={s.icon}>{a.icon ?? '📝'}</span>
                  {a.passed && <span style={s.passedBadge}>✓ Passed</span>}
                </div>
                <h2 style={s.title}>{a.title}</h2>
                <p style={s.desc}>{a.description}</p>
                <div style={s.meta}>{a.totalQuestions} questions · pass {a.passingScore}%</div>
                {a.bestScore != null && (
                  <div style={s.progressWrap}>
                    <div style={s.progressTrack}><div style={{ ...s.progressFill, width: `${a.bestScore}%`, background: a.bestScore >= a.passingScore ? '#8DC63F' : '#F5C842' }} /></div>
                    <span style={s.bestScore}>Best: {a.bestScore}%</span>
                  </div>
                )}
                <Link href={`/skills/${a.slug}`} style={s.takeBtn}>{a.bestScore != null ? 'Retake test' : 'Take test →'}</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#F4F3EE', padding: 'var(--space-2)' },
  wrap: { maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, margin: 0, color: '#1A1916' },
  sub: { fontSize: 14, color: '#6b6860', margin: '4px 0 0' },
  nudge: { background: '#fff', borderRadius: 12, border: '1px solid #efefe9', padding: 14, fontSize: 14, color: '#6b6860', textAlign: 'center' },
  link: { color: '#3A9EA5', fontWeight: 600 },
  muted: { color: '#9a9a92', padding: 20, textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 },
  card: { background: '#fff', borderRadius: 14, border: '1px solid #efefe9', padding: 18, display: 'flex', flexDirection: 'column', gap: 6 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  icon: { fontSize: 32 },
  passedBadge: { fontSize: 11, background: 'rgba(141,198,63,0.2)', color: '#3A6B1A', borderRadius: 999, padding: '3px 10px', fontWeight: 700 },
  title: { fontSize: 18, margin: '6px 0 0', color: '#1A1916' },
  desc: { fontSize: 13, color: '#6b6860', margin: 0, lineHeight: 1.5 },
  meta: { fontSize: 12, color: '#9a9a92' },
  progressWrap: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 },
  progressTrack: { flex: 1, height: 8, background: '#efefe9', borderRadius: 4 },
  progressFill: { height: '100%', borderRadius: 4 },
  bestScore: { fontSize: 12, color: '#6b6860', whiteSpace: 'nowrap' },
  takeBtn: { marginTop: 8, textAlign: 'center', background: '#F5C842', color: '#0F1A1B', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14 },
};
