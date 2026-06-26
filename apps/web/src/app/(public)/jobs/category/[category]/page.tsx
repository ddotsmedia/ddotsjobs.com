import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerTrpc } from '@/lib/trpc/server';
import { SegmentJobsPage } from '@/components/SegmentJobsPage';
import { CATEGORY_SEO } from '@/lib/constants';

export const revalidate = 60;

type Props = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return CATEGORY_SEO.map((c) => ({ category: c.param }));
}

function configFor(param: string) {
  return CATEGORY_SEO.find((c) => c.param === param) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cfg = configFor(category);
  if (!cfg) return { title: 'Jobs — ddotsjobs.com' };
  const title = `${cfg.display} in Kerala — ddotsjobs.com`;
  const description = `Find verified ${cfg.display.toLowerCase()} across all 14 Kerala districts.`;
  return { title, description, openGraph: { title, description } };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const cfg = configFor(category);
  if (!cfg) notFound();

  let items: Awaited<ReturnType<Awaited<ReturnType<typeof getServerTrpc>>['jobs']['segment']>>['items'] = [];
  try {
    const trpc = await getServerTrpc();
    items = (await trpc.jobs.segment({ category: cfg.db, limit: 50 })).items;
  } catch {
    items = [];
  }

  return (
    <SegmentJobsPage
      title={`${cfg.display} in Kerala`}
      subtitle={`Verified ${cfg.display.toLowerCase()} across all 14 districts.`}
      items={items}
    />
  );
}
