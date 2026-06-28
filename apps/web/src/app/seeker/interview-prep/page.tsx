import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InterviewPrepLoader } from '@/components/seeker/InterviewPrepLoader';

export const metadata: Metadata = { title: 'Interview Prep — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function InterviewPrepPage() {
  return (
    <main style={{ background: 'var(--color-neutral)', minHeight: '100dvh' }}>
      <Suspense>
        <InterviewPrepLoader />
      </Suspense>
    </main>
  );
}
