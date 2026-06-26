import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const metadata: Metadata = { title: 'Admin — ddotsjobs.com', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminDashboardPage() {
  return <AdminDashboard />;
}
