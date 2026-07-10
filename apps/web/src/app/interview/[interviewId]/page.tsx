import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { RecordingStudio } from '@/components/interview/RecordingStudio';

export const metadata: Metadata = { title: 'Video interview — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function InterviewPage({ params }: { params: Promise<{ interviewId: string }> }) {
  const { interviewId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?redirect=/interview/${interviewId}`);
  return (
    <main style={{ background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-4)' }}>
      <RecordingStudio interviewId={interviewId} />
    </main>
  );
}
