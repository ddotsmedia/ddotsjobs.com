import type { Metadata } from 'next';
import { Suspense } from 'react';
import { UnsubscribeClient } from './UnsubscribeClient';

export const metadata: Metadata = { title: 'Unsubscribe — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function UnsubscribePage() {
  return (
    <main style={{ background: 'var(--color-neutral)', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)' }}>
      <Suspense fallback={null}>
        <UnsubscribeClient />
      </Suspense>
    </main>
  );
}
