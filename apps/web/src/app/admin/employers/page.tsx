import type { Metadata } from 'next';
import { EmployerManagement } from '@/components/admin/EmployerManagement';

export const metadata: Metadata = { title: 'Employer management — admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function AdminEmployersPage() {
  return <EmployerManagement />;
}
