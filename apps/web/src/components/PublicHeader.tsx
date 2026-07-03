'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Logo } from '@/components/Logo';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';

export function PublicHeader() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const dashboardHref = role === 'employer' ? '/employer/dashboard' : role ? '/seeker/dashboard' : null;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header style={{ ...s.header, boxShadow: scrolled ? '0 2px 12px rgba(0,0,0,0.08)' : 'none' }}>
      <div style={s.inner}>
        <Logo size="md" showText href="/" />

        {/* Desktop nav */}
        <nav className="ddj-desktop-only" style={s.desktopNav}>
          <Link href="/jobs" style={s.link}>Jobs</Link>
          <Link href="/psc" style={s.link}>PSC</Link>
          <Link href="/gulf-return" style={s.link}>Gulf Return</Link>
          <Link href="/healthcare-jobs" style={s.link}>Healthcare</Link>
          <Link href="/salary-guide" style={s.link}>Salary</Link>
          <Link href="/jobs?type=walk_in" style={s.link}>Walk-in</Link>
          <a href="https://wa.me/971509379212" target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp" style={s.waIcon}>
            <WhatsAppIcon size={20} />
          </a>
          {dashboardHref ? (
            <Link href={dashboardHref} style={s.loginBtn}>Dashboard</Link>
          ) : (
            <>
              <Link href="/employer/register" style={s.postBtn}>Post a job</Link>
              <Link href="/login" style={s.link}>Sign in</Link>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button type="button" className="ddj-mobile-only" onClick={() => setOpen((v) => !v)} aria-label="Menu" style={s.hamburger}>
          ☰
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="ddj-mobile-only" style={s.dropdown}>
          {dashboardHref ? (
            <Link href={dashboardHref} style={s.dropItem} onClick={() => setOpen(false)}>Dashboard</Link>
          ) : (
            <>
              <Link href="/login" style={s.dropItem} onClick={() => setOpen(false)}>Sign in</Link>
              <Link href="/employer/register" style={s.dropItem} onClick={() => setOpen(false)}>Post a job</Link>
            </>
          )}
          <Link href="/jobs" style={s.dropItem} onClick={() => setOpen(false)}>Browse jobs</Link>
          <Link href="/healthcare-jobs" style={s.dropItem} onClick={() => setOpen(false)}>Healthcare</Link>
          <Link href="/technopark-jobs" style={s.dropItem} onClick={() => setOpen(false)}>IT Parks</Link>
          <Link href="/cooperative-jobs" style={s.dropItem} onClick={() => setOpen(false)}>Cooperative</Link>
          <Link href="/driver-jobs" style={s.dropItem} onClick={() => setOpen(false)}>Driver & Transport</Link>
          <Link href="/startup-jobs" style={s.dropItem} onClick={() => setOpen(false)}>Startup Jobs</Link>
          <Link href="/gulf-return" style={s.dropItem} onClick={() => setOpen(false)}>Gulf Return</Link>
          <Link href="/overseas-jobs" style={s.dropItem} onClick={() => setOpen(false)}>Overseas Jobs</Link>
          <Link href="/women-friendly-jobs" style={s.dropItem} onClick={() => setOpen(false)}>Jobs for Women</Link>
          <Link href="/psc" style={s.dropItem} onClick={() => setOpen(false)}>PSC Tracker</Link>
          <Link href="/salary-guide" style={s.dropItem} onClick={() => setOpen(false)}>Salary Guide</Link>
          <Link href="/skill-development" style={s.dropItem} onClick={() => setOpen(false)}>Skill Development</Link>
          <Link href="/jobs?type=walk_in" style={s.dropItem} onClick={() => setOpen(false)}>Walk-in Jobs</Link>
          <Link href="/fresher-jobs" style={s.dropItem} onClick={() => setOpen(false)}>Fresher Jobs</Link>
          <Link href="/ayurveda-jobs" style={s.dropItem} onClick={() => setOpen(false)}>Ayurveda Jobs</Link>
          <Link href="/community" style={s.dropItem} onClick={() => setOpen(false)}>Community</Link>
          <Link href="/career-paths" style={s.dropItem} onClick={() => setOpen(false)}>Career Paths</Link>
          <Link href="/labour-rights" style={s.dropItem} onClick={() => setOpen(false)}>Labour Rights</Link>
        </div>
      )}
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
    borderBottom: '1px solid rgba(26,25,22,0.08)',
  },
  inner: {
    width: '100%',
    maxWidth: 1040,
    margin: '0 auto',
    height: 60,
    padding: '0 var(--space-3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-2)',
  },
  desktopNav: {},
  link: { fontSize: 14, fontWeight: 600, color: '#3A9EA5', whiteSpace: 'nowrap', marginLeft: 'var(--space-3)' },
  waIcon: { display: 'inline-flex', alignItems: 'center', padding: 8, marginLeft: 'var(--space-2)' },
  postBtn: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1A1916',
    background: '#F5C842',
    padding: '8px 20px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    marginLeft: 'var(--space-3)',
  },
  loginBtn: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1A1916',
    background: '#F5C842',
    padding: '8px 20px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    marginLeft: 'var(--space-3)',
  },
  hamburger: { fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44, color: '#1A1916' },
  dropdown: {
    width: '100%',
    flexDirection: 'column',
    borderTop: '1px solid rgba(26,25,22,0.08)',
    background: '#fff',
    padding: 'var(--space-1) var(--space-3) var(--space-2)',
  },
  dropItem: { display: 'block', padding: '12px 0', fontSize: 15, fontWeight: 600, color: '#1A1916', borderBottom: '1px solid #f4f3ee' },
};
