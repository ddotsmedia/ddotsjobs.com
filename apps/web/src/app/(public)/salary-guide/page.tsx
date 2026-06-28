import type { Metadata } from 'next';
import { Hub, HubSection, SalaryTable, Bullets, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 86400;
export const metadata: Metadata = {
  title: 'Kerala Salary Guide 2026 — Nurse, IT, Teacher, Driver | ddotsjobs.com',
  description: 'Kerala salary benchmarks 2026 by profession and district — nurse, software engineer, teacher, driver and more. Median monthly pay + negotiation tips.',
  alternates: { canonical: 'https://ddotsjobs.com/salary-guide' },
};

export default function SalaryGuidePage() {
  return (
    <Hub
      kicker="Salary guide"
      title="Kerala Salary Guide 2026"
      titleMl="Kerala ശമ്പള വിവരം 2026"
      sub="Honest monthly salary benchmarks across Kerala professions — so you know your worth before you apply."
    >
      <HubSection title="Median salary by role (per month)">
        <SalaryTable rows={[
          ['Staff Nurse (Ernakulam)', '₹25K · ₹35K · ₹55K'],
          ['Senior Nurse', '₹45K · ₹60K · ₹80K'],
          ['Software Engineer (TVM)', '₹45K · ₹80K · ₹1.5L'],
          ['React / Full-stack Dev', '₹50K · ₹90K · ₹1.6L'],
          ['School Teacher (private)', '₹15K · ₹25K · ₹40K'],
          ['Govt Teacher (KTET)', '₹30K · ₹45K · ₹65K'],
          ['Lab Technician', '₹20K · ₹30K · ₹40K'],
          ['Pharmacist', '₹18K · ₹26K · ₹35K'],
          ['Cooperative Clerk', '₹20K · ₹28K · ₹35K'],
          ['Heavy Vehicle Driver', '₹25K · ₹32K · ₹45K'],
          ['Construction Site Engineer', '₹30K · ₹50K · ₹80K'],
        ]} />
        <p style={{ fontSize: 12, color: '#9a9a92', margin: 0 }}>Format: min · median · max. Based on Kerala market data 2026.</p>
      </HubSection>

      <HubSection title="What moves your salary">
        <Bullets items={[
          'Experience — each 2–3 years typically adds a band.',
          'Location — Ernakulam/Trivandrum pay more than smaller districts.',
          'Qualification & verification — KNMC/KTET-verified candidates earn more.',
          'Sector — IT and healthcare lead; cooperative/govt offer stability.',
        ]} />
      </HubSection>

      <HubSection title="ശമ്പളം negotiate ചെയ്യാൻ (negotiation tips)">
        <Bullets items={[
          'നിങ്ങളുടെ market rate അറിയുക — ഈ guide reference ആക്കുക.',
          'Take-home അല്ല, total CTC ചോദിക്കുക (PF, ESI, allowances).',
          'Verified certificates (KNMC/KTET) leverage ആയി ഉപയോഗിക്കുക.',
          'Competing offer ഉണ്ടെങ്കിൽ politely പറയുക.',
        ]} />
      </HubSection>

      <CtaLink href="/jobs">See jobs with salary upfront →</CtaLink>
    </Hub>
  );
}
