import type { ReactNode } from 'react';
import { ContactBar } from '@/components/ContactBar';
import { PublicHeader } from '@/components/PublicHeader';
import { WhatsAppWidget } from '@/components/WhatsAppWidget';

// Wraps all public routes: contact bar + sticky navigation + floating WhatsApp.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContactBar />
      <PublicHeader />
      {children}
      <WhatsAppWidget />
    </>
  );
}
