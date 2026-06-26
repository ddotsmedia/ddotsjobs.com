import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ItParkHubPage } from '@/components/ItParkHubPage';
import { loadPark } from '@/lib/loadPark';

export const revalidate = 60;
const SLUG = 'technopark';

export async function generateMetadata(): Promise<Metadata> {
  const { park } = await loadPark(SLUG);
  const title = park?.seoTitle ?? 'Technopark Jobs — ddotsjobs.com';
  const description =
    park?.seoDescription ?? 'Find IT jobs at Technopark, Thiruvananthapuram.';
  return { title, description, openGraph: { title, description } };
}

export default async function Page() {
  const { park, jobs } = await loadPark(SLUG);
  if (!park) notFound();
  return <ItParkHubPage park={park} jobs={jobs} />;
}
