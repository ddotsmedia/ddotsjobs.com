import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ItParkHubPage } from '@/components/ItParkHubPage';
import { loadPark } from '@/lib/loadPark';

export const revalidate = 60;
const SLUG = 'cyberpark';

export async function generateMetadata(): Promise<Metadata> {
  const { park } = await loadPark(SLUG);
  const title = park?.seoTitle ?? 'Cyberpark Jobs — ddotsjobs.com';
  const description = park?.seoDescription ?? 'Find IT jobs at Cyberpark, Kozhikode.';
  return { title, description, openGraph: { title, description } };
}

export default async function Page() {
  const { park, jobs } = await loadPark(SLUG);
  if (!park) notFound();
  return <ItParkHubPage park={park} jobs={jobs} />;
}
