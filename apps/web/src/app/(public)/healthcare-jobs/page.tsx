import type { Metadata } from 'next';
import { Hub, HubSection, Cards, Card, SalaryTable, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Healthcare Jobs Kerala 2026 — Nursing, Doctor, Lab | ddotsjobs.com',
  description: 'Verified healthcare jobs in Kerala — Staff Nurse (KNMC), Doctor, Lab Technician, Pharmacist, Physiotherapist. Salary benchmarks + top hospital employers.',
  alternates: { canonical: 'https://ddotsjobs.com/healthcare-jobs' },
};

export default function HealthcareJobsPage() {
  return (
    <Hub
      kicker="Healthcare"
      title="Healthcare Jobs Kerala 2026"
      titleMl="Healthcare ജോലികൾ — കേരളം"
      sub="Kerala's #1 job category. Verified hospital roles with salary upfront and KNMC-verified nurse badges."
    >
      <HubSection title="Roles">
        <Cards>
          <Card title="Staff Nurse" href="/jobs?category=nursing">KNMC registration required</Card>
          <Card title="Doctor / Medical Officer">MBBS / specialist</Card>
          <Card title="Lab Technician">DMLT / BSc MLT</Card>
          <Card title="Pharmacist">D.Pharm / B.Pharm</Card>
          <Card title="Physiotherapist">BPT / MPT</Card>
          <Card title="Nursing Assistant / GNM">GNM / ANM</Card>
          <Card title="BAMS / Ayurveda">Ayurveda practitioner</Card>
          <Card title="Hospital Admin / Records">Operations + MRD</Card>
        </Cards>
      </HubSection>

      <HubSection title="Salary benchmarks (per month)">
        <SalaryTable rows={[['Staff Nurse', '₹25,000 – ₹50,000'], ['Senior Nurse', '₹45,000 – ₹80,000'], ['Doctor / MO', '₹60,000 – ₹2,00,000+'], ['Lab Technician', '₹20,000 – ₹40,000'], ['Pharmacist', '₹18,000 – ₹35,000']]} />
      </HubSection>

      <HubSection title="KNMC verification">
        <Cards>
          <Card title="Get KNMC verified on ddotsjobs" href="/seeker/profile/verify">Upload your KNMC certificate — verified nurses get a teal badge and rank higher with employers.</Card>
          <Card title="KNMC registration guide" href="https://knmc.kerala.gov.in">Registration number format + how to register on the Kerala Nurses & Midwives Council site.</Card>
        </Cards>
      </HubSection>

      <HubSection title="Top hospital employers">
        <Cards>
          <Card title="KIMS" />
          <Card title="Aster Medcity" />
          <Card title="Lakeshore" />
          <Card title="Amrita" />
          <Card title="Medical College hospitals" />
        </Cards>
      </HubSection>

      <CtaLink href="/jobs?category=nursing">Browse healthcare jobs →</CtaLink>
    </Hub>
  );
}
