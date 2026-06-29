import type { Metadata } from 'next';
import { SiteSettings } from '@/components/admin/SiteSettings';

export const metadata: Metadata = { title: 'Site settings — admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function SiteSettingsPage() {
  return <SiteSettings />;
}
