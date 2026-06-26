import type { Metadata } from 'next';
import { ApplicationsList } from '@/components/seeker/ApplicationsList';

export const metadata: Metadata = { title: 'My Applications — ddotsjobs.com' };

export default function ApplicationsPage() {
  return <ApplicationsList />;
}
