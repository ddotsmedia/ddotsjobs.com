import type { Metadata } from 'next';
import { NotificationsList } from '@/components/NotificationsList';

export const metadata: Metadata = { title: 'Notifications — ddotsjobs.com' };

export default function EmployerNotificationsPage() {
  return <NotificationsList />;
}
