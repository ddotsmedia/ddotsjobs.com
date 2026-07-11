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
  { label: 'Dashboard', href: '/employer/dashboard' },
  { label: 'Analytics', href: '/employer/analytics' },
  { label: 'Post a Job', href: '/employer/jobs/new' },
  { label: 'My Jobs', href: '/employer/jobs' },
  { label: 'Applicants', href: '/employer/applicants' },
  { label: 'Messages', href: '/chat' },
  { label: 'Walk-in Drives', href: '/employer/walkin' },
  { label: 'Talent Pool', href: '/employer/talent', locked: true },
  { label: 'Company Profile', href: '/employer/profile' },
  { label: 'Branding', href: '/employer/company-profile' },
  { label: 'Email Settings', href: '/employer/preferences' },
  { label: 'Billing', href: '/employer/billing' },
] as const;

export function EmployerSidebar({ company, verified }: { company: string; verified: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signOutMut = trpc.auth.signOut.useMutation();
  const chatUnread = trpc.chat.unreadCount.useQuery(undefined, { refetchInterval: 20_000 }).data?.count ?? 0;

  async function doSignOut() {
    try {
      await signOutMut.mutateAsync();
    } catch {
      /* ignore */
    }
    await signOut({ callbackUrl: '/' });
  }

  const inner = (
    <>
      <div style={s.brandRow}>
        <Logo size="sm" showText href="/" />
        <NotificationBell viewAllHref="/employer/notifications" />
      </div>
      <div style={s.company}>
        <span style={s.avatar} aria-hidden>{initials(company || 'Co')}</span>
        <div style={{ minWidth: 0 }}>
          <div style={s.name}>{company || 'Company'}</div>
          <span style={{ ...s.badge, ...(verified ? s.ok : s.pending) }}>{verified ? '✓ Verified' : 'Pending'}</span>
        </div>
      </div>
      <nav style={s.nav}>
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
              <span>{n.label}</span>
              {'locked' in n && n.locked && <span style={s.lock} aria-label="Locked">🔒</span>}
              {n.href === '/chat' && chatUnread > 0 && <span style={s.countBadge}>{chatUnread}</span>}
            </Link>
          );
        })}
      </nav>
      <button type="button" onClick={doSignOut} style={s.signout}>Sign out</button>
    </>
  );

  return (
    <>
      <div style={s.mobileBar} className="ddj-mobile-only">
        <button type="button" onClick={() => setOpen(true)} aria-label="Menu" style={s.hamburger}>☰</button>
        <Logo size="sm" showText href="/" />
      </div>
      <aside style={s.sidebar} className="ddj-desktop-only">{inner}</aside>
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
  company: { display: 'flex', gap: 10, alignItems: 'center' },
  avatar: { width: 40, height: 40, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: 10 },
  name: { fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: '9999px' },
  ok: { background: '#e6f5ea', color: '#1d7a3a' },
  pending: { background: '#fdf0d5', color: '#9a6b00' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', fontSize: 14, color: '#55554f', borderRadius: 'var(--radius-input)' },
  navActive: { background: '#fdf3da', color: '#0f0e0c', fontWeight: 600 },
  lock: { fontSize: 12 },
  countBadge: { minWidth: 20, height: 20, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--color-accent)', borderRadius: 999 },
  signout: { marginTop: 'auto', padding: '10px 12px', fontSize: 14, fontWeight: 600, color: '#c0392b', background: 'none', border: '1px solid #f0d3cf', borderRadius: 'var(--radius-input)', cursor: 'pointer' },
  mobileBar: { alignItems: 'center', gap: 12, padding: 'var(--space-2)', background: '#fff', borderBottom: '1px solid #efefe9', position: 'sticky', top: 0, zIndex: 20 },
  hamburger: { fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44 },
  mobileBrand: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', color: 'var(--color-accent)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.4)', zIndex: 60, display: 'flex' },
  drawer: { width: 260, maxWidth: '85vw', minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-2)', background: '#fff' },
};
