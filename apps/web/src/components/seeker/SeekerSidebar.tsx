'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { trpc } from '@/lib/trpc/client';
import { NotificationBell } from '@/components/NotificationBell';
import { Logo } from '@/components/Logo';
import { initials } from '@/lib/format';

const NAV = [
  { label: 'Dashboard', href: '/seeker/dashboard' },
  { label: 'Find Jobs', href: '/jobs' },
  { label: 'My Applications', href: '/seeker/applications' },
  { label: 'Saved Jobs', href: '/seeker/saved-jobs' },
  { label: 'Job Alerts', href: '/seeker/alerts' },
  { label: 'PSC Tracker', href: '/seeker/psc/tracker' },
  { label: 'Gulf Return', href: '/seeker/gulf-return/setup' },
  { label: 'My Profile', href: '/seeker/profile' },
  { label: 'Verify Credentials', href: '/seeker/profile/verify' },
  { label: 'Privacy', href: '/seeker/profile/privacy' },
] as const;

export function SeekerSidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signOutMut = trpc.auth.signOut.useMutation();
  const savedCount = trpc.jobs.getSavedJobCount.useQuery(undefined, { staleTime: 60_000 }).data?.count ?? 0;

  async function doSignOut() {
    try {
      await signOutMut.mutateAsync();
    } catch {
      // ignore — still clear the cookie session below
    }
    await signOut({ callbackUrl: '/' });
  }

  const inner = (
    <>
      <div style={s.brandRow}>
        <Logo size="sm" showText href="/" />
        <NotificationBell viewAllHref="/seeker/notifications" />
      </div>
      <div style={s.user}>
        <span style={s.avatar} aria-hidden>{initials(name || 'You')}</span>
        <div style={{ minWidth: 0 }}>
          <div style={s.name}>{name || 'Seeker'}</div>
          <div style={s.role}>Job seeker</div>
        </div>
      </div>
      <nav style={s.nav}>
        {NAV.map((n) => {
          const active = pathname === n.href;
          const showBadge = n.href === '/seeker/saved-jobs' && savedCount > 0;
          return (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} style={{ ...s.navItem, ...(active ? s.navActive : {}), ...(showBadge ? s.navItemBadged : {}) }}>
              <span>{n.label}</span>
              {showBadge && <span style={s.badge}>{savedCount}</span>}
            </Link>
          );
        })}
      </nav>
      <button type="button" onClick={doSignOut} style={s.signout}>Sign out</button>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div style={s.mobileBar} className="ddj-mobile-only">
        <button type="button" onClick={() => setOpen(true)} aria-label="Menu" style={s.hamburger}>☰</button>
        <Logo size="sm" showText href="/" />
      </div>

      {/* Desktop sidebar */}
      <aside style={s.sidebar} className="ddj-desktop-only">{inner}</aside>

      {/* Mobile drawer */}
      {open && (
        <div style={s.overlay} onClick={() => setOpen(false)}>
          <aside style={s.drawer} onClick={(e) => e.stopPropagation()}>{inner}</aside>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  sidebar: { flex: '0 0 220px', width: 220, minHeight: '100dvh', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-2)', background: '#fff', borderRight: '1px solid #efefe9' },
  brandRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--color-accent)' },
  user: { display: 'flex', gap: 10, alignItems: 'center' },
  avatar: { width: 40, height: 40, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: '9999px' },
  name: { fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  role: { fontSize: 12, color: '#9a9a92' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: { padding: '10px 12px', fontSize: 14, color: '#55554f', borderRadius: 'var(--radius-input)' },
  navItemBadged: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navActive: { background: '#fdf3da', color: '#0f0e0c', fontWeight: 600 },
  badge: { minWidth: 20, height: 20, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--color-accent)', borderRadius: 999 },
  signout: { marginTop: 'auto', padding: '10px 12px', fontSize: 14, fontWeight: 600, color: '#c0392b', background: 'none', border: '1px solid #f0d3cf', borderRadius: 'var(--radius-input)', cursor: 'pointer' },
  mobileBar: { alignItems: 'center', gap: 12, padding: 'var(--space-2)', background: '#fff', borderBottom: '1px solid #efefe9', position: 'sticky', top: 0, zIndex: 20 },
  hamburger: { fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44 },
  mobileBrand: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', color: 'var(--color-accent)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.4)', zIndex: 60, display: 'flex' },
  drawer: { width: 260, maxWidth: '85vw', minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-2)', background: '#fff' },
};
