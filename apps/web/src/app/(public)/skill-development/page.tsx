import type { Metadata } from 'next';
import { Hub, HubSection, Cards, Card, Bullets, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Skill Development Kerala 2026 — ASAP, ITI, CSEB | ddotsjobs.com',
  description: 'Upskill for Kerala jobs — ASAP Kerala programs, ITI courses → jobs, KMAT/CSEB exam prep, KNMC/KTET guides. Connect skills to real openings.',
  alternates: { canonical: 'https://ddotsjobs.com/skill-development' },
};

export default function SkillDevelopmentPage() {
  return (
    <Hub
      kicker="Upskill"
      title="Skill Development Hub"
      titleMl="Skill Development — കേരളം"
      sub="Connect the skills employers want to the training that gets you there."
    >
      <HubSection title="ASAP Kerala programs">
        <Cards>
          <Card title="Healthcare skills" href="https://asapkerala.gov.in">Nursing assistant, patient care.</Card>
          <Card title="IT skills" href="https://asapkerala.gov.in">Full-stack, data, support.</Card>
          <Card title="Hospitality skills" href="https://asapkerala.gov.in">Hotel, F&B, tourism.</Card>
          <Card title="Construction skills" href="https://asapkerala.gov.in">Electrical, welding, plumbing.</Card>
        </Cards>
      </HubSection>

      <HubSection title="ITI courses → jobs">
        <Bullets items={[
          'ITI Electrical → electrician & maintenance roles.',
          'ITI Welding → fabrication & site jobs.',
          'ITI Fitter / Mechanic → manufacturing & automotive.',
          'ITI COPA → data entry & office roles.',
        ]} />
      </HubSection>

      <HubSection title="Exam prep & certifications">
        <Cards>
          <Card title="KMAT Kerala">Management admission test.</Card>
          <Card title="CSEB exam" href="/cooperative-jobs">Cooperative bank recruitment.</Card>
          <Card title="KNMC registration" href="/seeker/profile/verify">For nursing jobs.</Card>
          <Card title="KTET preparation">For teaching jobs.</Card>
        </Cards>
      </HubSection>

      <CtaLink href="/jobs">See jobs by skill →</CtaLink>
    </Hub>
  );
}
