import type { Metadata } from 'next';
import { EmployerProfile } from '@/components/employer/EmployerProfile';

export const metadata: Metadata = { title: 'Company profile — ddotsjobs.com' };

export default function EmployerProfilePage() {
  return <EmployerProfile />;
}
