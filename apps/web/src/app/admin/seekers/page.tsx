import type { Metadata } from 'next';
import { SeekerManagement } from '@/components/admin/SeekerManagement';

export const metadata: Metadata = { title: 'Seeker management — admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function AdminSeekersPage() {
  return <SeekerManagement />;
}
