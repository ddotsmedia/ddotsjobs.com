import type { Metadata } from 'next';
import { NotificationsList } from '@/components/NotificationsList';

export const metadata: Metadata = { title: 'Notifications — ddotsjobs admin', robots: { index: false } };

export default function AdminNotificationsPage() {
  return <NotificationsList />;
}
