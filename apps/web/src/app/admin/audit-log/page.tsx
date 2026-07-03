import type { Metadata } from 'next';
import { AuditLog } from '@/components/admin/AuditLog';

export const metadata: Metadata = { title: 'Audit Log — admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function AdminAuditLogPage() {
  return <AuditLog />;
}
