import type { ReactNode } from 'react';
import { MobileBottomNav } from '@/components/MobileBottomNav';

// Seeker area: adds the mobile bottom navigation (hidden on desktop) below every
// seeker page. The spacer keeps fixed-nav from covering page content.
export default function SeekerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="ddj-bottom-nav-spacer" aria-hidden />
      <MobileBottomNav />
    </>
  );
}
