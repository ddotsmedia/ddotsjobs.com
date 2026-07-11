import type { Metadata } from 'next';
import { AdminTenants } from '@/components/admin/AdminTenants';

export const metadata: Metadata = { title: 'Tenants — Admin — ddotsjobs.com', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminTenantsPage() {
  return <AdminTenants />;
}
