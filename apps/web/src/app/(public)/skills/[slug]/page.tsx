import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { QuizContainer } from '@/components/skills/QuizContainer';

export const metadata: Metadata = { title: 'Assessment — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AssessmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?next=/skills/${slug}`);
  return <QuizContainer slug={slug} />;
}
