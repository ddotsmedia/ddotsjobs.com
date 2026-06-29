import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Join ddotsjobs — Job Seeker or Employer',
  description: 'Register on ddotsjobs.com — free for job seekers, post 3 jobs free for employers.',
};

export default function RegisterChooserPage() {
  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <h1 style={s.h1}>Join ddotsjobs</h1>
        <p style={s.sub}>Choose how you want to start.</p>

        <div style={s.cards}>
          {/* Job Seeker */}
          <div style={{ ...s.card, background: 'linear-gradient(135deg,#3A9EA5,#2E8A91)' }}>
            <span style={s.icon} aria-hidden>👤</span>
            <h2 style={s.cardTitle}>I&rsquo;m looking for a job</h2>
            <p style={s.cardMl}>ഞാൻ ജോലി തിരയുന്നു</p>
            <ul style={s.points}>
              {['Free forever', 'WhatsApp job alerts', 'AI resume builder', 'Interview prep tools', 'KNMC / KTET verification'].map((p) => (
                <li key={p} style={s.point}>✓ {p}</li>
              ))}
            </ul>
            <Link href="/login?next=/seeker/profile/setup" style={{ ...s.btn, background: '#fff', color: '#3A9EA5' }}>Register as Job Seeker</Link>
          </div>

          {/* Employer */}
          <div style={{ ...s.card, background: 'linear-gradient(135deg,#F5C842,#E0B530)' }}>
            <span style={s.icon} aria-hidden>🏢</span>
            <h2 style={{ ...s.cardTitle, color: '#1A1916' }}>I&rsquo;m hiring</h2>
            <p style={{ ...s.cardMl, color: 'rgba(15,26,27,0.7)' }}>ഞാൻ ആളെ നിയമിക്കുന്നു</p>
            <ul style={s.points}>
              {['Post 3 jobs free', 'Reach 120K+ professionals', 'AI job description writer', 'WhatsApp distribution', 'Talent pool access'].map((p) => (
                <li key={p} style={{ ...s.point, color: '#1A1916' }}>✓ {p}</li>
              ))}
            </ul>
            <Link href="/employer/register" style={{ ...s.btn, background: '#0F1A1B', color: '#fff' }}>Register as Employer</Link>
          </div>
        </div>

        <p style={s.foot}>Already have an account? <Link href="/login" style={s.signin}>Sign in →</Link></p>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3) var(--space-2)' },
  wrap: { width: '100%', maxWidth: 880, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(2rem,6vw,2.8rem)', color: '#fff', margin: 0, textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, margin: 0, textAlign: 'center' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'var(--space-2)', width: '100%', marginTop: 'var(--space-2)' },
  card: { display: 'flex', flexDirection: 'column', gap: 8, padding: 'var(--space-3)', borderRadius: 20, color: '#fff' },
  icon: { fontSize: 56, lineHeight: 1 },
  cardTitle: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.6rem', margin: '8px 0 0', color: '#fff' },
  cardMl: { fontSize: 15, margin: 0, color: 'rgba(255,255,255,0.85)' },
  points: { listStyle: 'none', margin: '8px 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  point: { fontSize: 14, color: 'rgba(255,255,255,0.95)' },
  btn: { marginTop: 8, textAlign: 'center', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15 },
  foot: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 'var(--space-2)' },
  signin: { color: '#F5C842', fontWeight: 600 },
};
