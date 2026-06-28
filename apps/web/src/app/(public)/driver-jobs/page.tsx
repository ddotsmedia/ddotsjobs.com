import type { Metadata } from 'next';
import { Hub, HubSection, Cards, Card, SalaryTable, Bullets, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Driver & Transport Jobs Kerala 2026 — ddotsjobs.com',
  description: 'Driver jobs across Kerala — school bus, heavy vehicle (HMV), LMV, delivery rider, forklift. Licence requirements + driver salary guide.',
  alternates: { canonical: 'https://ddotsjobs.com/driver-jobs' },
};

export default function DriverJobsPage() {
  return (
    <Hub
      kicker="Transport"
      title="Driver & Transport Jobs Kerala"
      titleMl="Driver ജോലികൾ — കേരളം"
      sub="Huge, year-round demand across Kerala — and a sector no portal covers properly."
    >
      <HubSection title="Sub-categories">
        <Cards>
          <Card title="School Bus Driver" />
          <Card title="Heavy Vehicle (HMV)" />
          <Card title="Light Motor Vehicle (LMV)" />
          <Card title="Autorickshaw permit" />
          <Card title="Courier / Delivery Rider" />
          <Card title="Forklift Operator" />
        </Cards>
      </HubSection>

      <HubSection title="Licence requirements">
        <Bullets items={[
          'LMV licence — cars, vans, small commercial vehicles.',
          'HMV licence — buses, lorries, heavy commercial vehicles.',
          'Badge / permit — required for commercial passenger vehicles.',
          'Clean driving record + age 21+ for most commercial roles.',
        ]} />
      </HubSection>

      <HubSection title="Driver salary guide (per month)">
        <SalaryTable rows={[['School bus driver', '₹15,000 – ₹25,000'], ['Private driver', '₹20,000 – ₹35,000'], ['Heavy vehicle (HMV)', '₹25,000 – ₹45,000'], ['Delivery rider', '₹15,000 – ₹30,000']]} />
      </HubSection>

      <CtaLink href="/jobs?category=transport">Browse driver jobs →</CtaLink>
    </Hub>
  );
}
