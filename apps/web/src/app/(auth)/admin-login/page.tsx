import type { Metadata } from 'next';
import { AdminLoginForm } from '@/components/AdminLoginForm';

export const metadata: Metadata = { title: 'Admin Sign In — ddotsjobs.com', robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
