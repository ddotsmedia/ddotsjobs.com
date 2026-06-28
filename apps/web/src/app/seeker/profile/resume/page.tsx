import type { Metadata } from 'next';
import { ResumeBuilder } from '@/components/seeker/ResumeBuilder';

export const metadata: Metadata = { title: 'AI Resume Builder — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function ResumePage() {
  return (
    <main style={{ background: 'var(--color-neutral)', minHeight: '100dvh' }}>
      <ResumeBuilder />
    </main>
  );
}
