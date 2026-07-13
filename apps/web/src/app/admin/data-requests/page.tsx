import type { Metadata } from 'next';
import { DataRequests } from '@/components/admin/DataRequests';

export const metadata: Metadata = { title: 'Data requests — admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function AdminDataRequestsPage() {
  return <DataRequests />;
}
