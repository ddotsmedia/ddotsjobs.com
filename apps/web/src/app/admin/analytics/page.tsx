import type { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';

export const metadata: Metadata = { title: 'Analytics — admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function AdminAnalyticsPage() {
  return <AnalyticsDashboard />;
}
