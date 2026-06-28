import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <main style={s.main}>
      <Logo size="lg" showText href="/" />
      <svg width="72" height="72" viewBox="0 0 24 24" fill="none" aria-hidden style={{ marginTop: 24 }}>
        <circle cx="11" cy="11" r="7" stroke="#3A9EA5" strokeWidth="1.6" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#3A9EA5" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="8" y1="11" x2="14" y2="11" stroke="#F5C842" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <h1 style={s.code}>404</h1>
      <p style={s.ml}>ഈ പേജ് കണ്ടെത്തിയില്ല</p>
      <p style={s.en}>This page could not be found.</p>
      <Link href="/" style={s.btn}>Back to homepage</Link>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: 'var(--color-neutral)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-3)', gap: 6 },
  code: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(3rem,12vw,5rem)', color: '#3A9EA5', margin: '8px 0 0', lineHeight: 1 },
  ml: { fontSize: '1.1rem', color: '#1A1916', margin: 0 },
  en: { fontSize: 14, color: '#6B6860', margin: '0 0 var(--space-2)' },
  btn: { marginTop: 8, padding: '12px 28px', fontWeight: 700, color: '#fff', background: '#3A9EA5', borderRadius: 'var(--radius-pill)' },
};
