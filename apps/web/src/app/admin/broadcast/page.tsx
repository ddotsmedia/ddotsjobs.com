import type { Metadata } from 'next';
import { BroadcastTool } from '@/components/admin/BroadcastTool';

export const metadata: Metadata = { title: 'Broadcast — admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function AdminBroadcastPage() {
  return <BroadcastTool />;
}
