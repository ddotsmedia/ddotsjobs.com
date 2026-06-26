import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { getServerTrpc } from '@/lib/trpc/server';
import { ReviewForm } from '@/components/reviews/ReviewForm';

export const metadata: Metadata = { title: 'Write a review — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function WriteReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trpc = await getServerTrpc();

  let data: Awaited<ReturnType<typeof trpc.reviews.getForEmployer>> | null = null;
  try {
    data = await trpc.reviews.getForEmployer({ employerSlug: slug, limit: 1 });
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
  if (!data) notFound();

  return (
    <main style={{ background: 'var(--color-neutral)', minHeight: '100dvh' }}>
      <ReviewForm employerId={data.employer.id} slug={slug} companyName={data.employer.name} />
    </main>
  );
}
