import type { Metadata } from 'next';
import { AdminDashboardLoader } from '@/components/admin/AdminDashboardLoader';

export const metadata: Metadata = { title: 'Admin — ddotsjobs.com', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminDashboardPage() {
  return <AdminDashboardLoader />;
}
