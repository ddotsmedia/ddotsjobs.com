import type { Metadata } from 'next';
import { MyJobsList } from '@/components/employer/MyJobsList';

export const metadata: Metadata = { title: 'My job posts — ddotsjobs.com' };

export default function MyJobsPage() {
  return <MyJobsList />;
}
