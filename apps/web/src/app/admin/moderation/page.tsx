import type { Metadata } from 'next';
import { ModerationQueue } from '@/components/admin/ModerationQueue';

export const metadata: Metadata = { title: 'Moderation — admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function AdminModerationPage() {
  return <ModerationQueue />;
}
