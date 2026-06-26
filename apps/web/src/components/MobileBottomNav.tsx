'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home', icon: '🏠', match: (p: string) => p === '/' },
  { href: '/jobs', label: 'Search', icon: '🔍', match: (p: string) => p.startsWith('/jobs') },
  { href: '/seeker/alerts', label: 'Alerts', icon: '🔔', match: (p: string) => p.startsWith('/seeker/alerts') },
  { href: '/seeker/applications', label: 'Applied', icon: '📄', match: (p: string) => p.startsWith('/seeker/applications') },
  { href: '/seeker/profile', label: 'Profile', icon: '👤', match: (p: string) => p.startsWith('/seeker/profile') || p.startsWith('/seeker/dashboard') },
] as const;

// Fixed 5-tab bottom navigation for seekers. Mobile only (hidden ≥1024px via CSS).
export function MobileBottomNav() {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="ddj-bottom-nav" aria-label="Primary">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} data-active={t.match(pathname)}>
          <span className="ddj-bn-icon" aria-hidden>{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
