import type { Metadata } from 'next';
import { ChangePassword } from '@/components/admin/ChangePassword';

export const metadata: Metadata = { title: 'Admin settings — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function AdminSettingsPage() {
  return <ChangePassword />;
}
