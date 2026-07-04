import { redirect } from 'next/navigation';

// Spec-URL alias → canonical /admin/audit-log.
export const dynamic = 'force-dynamic';

export default function AuditLogsAlias() {
  redirect('/admin/audit-log');
}
