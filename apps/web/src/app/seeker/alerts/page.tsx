import type { Metadata } from 'next';
import { AlertsManager } from '@/components/seeker/AlertsManager';

export const metadata: Metadata = { title: 'Job Alerts — ddotsjobs.com' };

export default function AlertsPage() {
  return <AlertsManager />;
}
