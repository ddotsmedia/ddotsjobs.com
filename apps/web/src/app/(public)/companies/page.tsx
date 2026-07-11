import type { Metadata } from 'next';
import { CompanyDirectory } from '@/components/company/CompanyDirectory';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Companies hiring in Kerala — ddotsjobs.com',
  description: 'Discover verified Kerala employers, their culture and open jobs on ddotsjobs.com.',
  alternates: { canonical: 'https://ddotsjobs.com/companies' },
};

export default function CompaniesPage() {
  return (
    <main style={{ background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' }}>
      <CompanyDirectory />
    </main>
  );
}
