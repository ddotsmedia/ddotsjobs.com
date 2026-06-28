'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <main style={s.main}>
      <span style={s.dot} aria-hidden>⚠️</span>
      <h1 style={s.title}>Something went wrong</h1>
      <p style={s.ml}>എന്തോ കുഴപ്പം സംഭവിച്ചു</p>
      <p style={s.en}>We hit a snag loading this page. Please try again.</p>
      <button type="button" onClick={reset} style={s.btn}>Try again</button>
      <p style={s.contact}>
        Still stuck? WhatsApp us at{' '}
        <a href="https://wa.me/971509379212" style={s.link}>+971 50 937 9212</a>
      </p>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: 'var(--color-neutral)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-3)', gap: 6 },
  dot: { fontSize: 44 },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.6rem)', color: '#1A1916', margin: '8px 0 0' },
  ml: { fontSize: '1.05rem', color: '#1A1916', margin: 0 },
  en: { fontSize: 14, color: '#6B6860', margin: '0 0 var(--space-2)' },
  btn: { marginTop: 8, padding: '12px 28px', fontWeight: 700, color: '#1A1916', background: '#F5C842', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  contact: { fontSize: 13, color: '#6B6860', marginTop: 'var(--space-2)' },
  link: { color: '#3A9EA5', fontWeight: 600 },
};
