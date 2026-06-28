import type { Metadata } from 'next';
import { Hub, HubSection, Cards, Card, SalaryTable, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Cooperative Sector Jobs Kerala 2026 — CSEB | ddotsjobs.com',
  description: 'Kerala cooperative bank & society jobs. CSEB exam tracker, Junior Clerk / Secretary / DEO roles, salary scales and preparation links.',
  alternates: { canonical: 'https://ddotsjobs.com/cooperative-jobs' },
};

export default function CooperativeJobsPage() {
  return (
    <Hub
      kicker="Cooperative"
      title="Cooperative Sector Jobs Kerala"
      titleMl="കേരളത്തിലെ Cooperative ജോലികൾ"
      sub="15,000+ cooperative societies. CSEB recruits for cooperative banks. The sector no other portal covers well."
    >
      <HubSection title="CSEB exam tracker">
        <Cards>
          <Card title="CSEB notifications" href="https://cseb.kerala.gov.in">Co-operative Service Examination Board — current exams, vacancy counts and last dates.</Card>
          <Card title="Get CSEB alerts on WhatsApp" href="/seeker/alerts">We message you when a new CSEB notification is published.</Card>
        </Cards>
      </HubSection>

      <HubSection title="Cooperative roles & salary (per month)">
        <SalaryTable rows={[['Junior Clerk', '₹20,000 – ₹35,000'], ['Data Entry Operator', '₹18,000 – ₹28,000'], ['Assistant Secretary', '₹30,000 – ₹45,000'], ['Secretary', '₹40,000 – ₹70,000'], ['System Administrator', '₹30,000 – ₹50,000']]} />
      </HubSection>

      <HubSection title="CSEB preparation">
        <Cards>
          <Card title="How to apply for CSEB 2026" href="https://cseb.kerala.gov.in">Official application process.</Card>
          <Card title="CSEB syllabus" href="https://cseb.kerala.gov.in">Exam pattern and subjects.</Card>
          <Card title="Previous year papers" href="https://cseb.kerala.gov.in">Practice resources.</Card>
        </Cards>
      </HubSection>

      <CtaLink href="/jobs?category=cooperative">Browse cooperative jobs →</CtaLink>
    </Hub>
  );
}
