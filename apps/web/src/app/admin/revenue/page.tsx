import type { Metadata } from 'next';
import { RevenueDashboard } from '@/components/admin/RevenueDashboard';

export const metadata: Metadata = { title: 'Revenue — admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function AdminRevenuePage() {
  return <RevenueDashboard />;
}
