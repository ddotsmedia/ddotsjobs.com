import type { ReactNode } from 'react';
import { PublicHeader } from '@/components/PublicHeader';

// Wraps all public routes with the sticky top navigation (logo + links).
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
