import type { Metadata } from 'next';
import { CompareView } from '@/components/jobs/CompareView';

export const metadata: Metadata = { title: 'Compare Jobs — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const idList = (ids ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3);
  return <CompareView ids={idList} />;
}
