import Link from 'next/link';
import { Logo } from '@/components/Logo';

// Sticky public top navigation. Logo left, primary links right.
export function PublicHeader() {
  return (
    <header style={s.header}>
      <div style={s.inner}>
        <Logo size="md" showText href="/" />
        <nav style={s.nav}>
          <span className="ddj-desktop-only" style={s.links}>
            <Link href="/jobs" style={s.link}>Jobs</Link>
            <Link href="/psc" style={s.link}>PSC</Link>
            <Link href="/gulf-return" style={s.linkWide}>Gulf Return</Link>
            <Link href="/employer/register" style={s.link}>Employers</Link>
          </span>
          <Link href="/login" style={s.loginBtn}>Sign in</Link>
        </nav>
      </div>
    </header>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  inner: {
    width: '100%',
    maxWidth: 1040,
    margin: '0 auto',
    padding: '10px var(--space-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-2)',
  },
  nav: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' },
  links: { gap: 'var(--space-2)', alignItems: 'center' },
  link: { fontSize: 14, fontWeight: 600, color: 'var(--brand)', marginLeft: 'var(--space-2)' },
  linkWide: { fontSize: 14, fontWeight: 600, color: 'var(--brand)', whiteSpace: 'nowrap', marginLeft: 'var(--space-2)' },
  loginBtn: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1A1916',
    background: 'var(--accent)',
    padding: '8px 16px',
    borderRadius: 'var(--radius-pill)',
    whiteSpace: 'nowrap',
  },
};
