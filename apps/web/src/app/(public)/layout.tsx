import type { ReactNode } from 'react';
import { ContactBar } from '@/components/ContactBar';
import { PublicHeader } from '@/components/PublicHeader';
import { WhatsAppWidget } from '@/components/WhatsAppWidget';
import { CompareTray } from '@/components/jobs/CompareTray';

// Wraps all public routes: contact bar + sticky navigation + floating WhatsApp.
// (maintenance_mode is enforced in middleware, not here — keeps pages static.)
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContactBar />
      <PublicHeader />
      {children}
      <CompareTray />
      <WhatsAppWidget />
    </>
  );
}
