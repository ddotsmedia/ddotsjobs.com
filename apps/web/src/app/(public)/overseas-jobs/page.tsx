import type { Metadata } from 'next';
import { Hub, HubSection, Cards, Card, Bullets, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Overseas Jobs for Keralites 2026 — NORKA | ddotsjobs.com',
  description: 'Verified overseas jobs for Kerala professionals via NORKA + direct employers. Gulf, UK, Germany, Canada. Country guides, NORKA schemes, documents checklist.',
  alternates: { canonical: 'https://ddotsjobs.com/overseas-jobs' },
};

export default function OverseasJobsPage() {
  return (
    <Hub
      kicker="Overseas"
      title="Overseas Jobs for Keralites"
      titleMl="Kerala professionals-നുള്ള Overseas Jobs"
      sub="Verified overseas opportunities via NORKA and direct employers — without middlemen."
    >
      <HubSection title="NORKA — Kerala's official overseas agency">
        <Cards>
          <Card title="NORKA opportunities" href="https://jobsnorka.gov.in">Kerala govt&rsquo;s official overseas recruitment portal.</Card>
          <Card title="NORKA Triple Win">Germany nursing recruitment programme.</Card>
          <Card title="Pre-Departure Orientation">NORKA training before you travel.</Card>
        </Cards>
      </HubSection>

      <HubSection title="Country guides">
        <Cards>
          <Card title="UAE 🇦🇪" />
          <Card title="Saudi Arabia 🇸🇦" />
          <Card title="Qatar 🇶🇦" />
          <Card title="Kuwait 🇰🇼" />
          <Card title="UK 🇬🇧" />
          <Card title="Germany 🇩🇪" />
          <Card title="Canada 🇨🇦" />
        </Cards>
      </HubSection>

      <HubSection title="Documents checklist">
        <Bullets items={[
          'Valid passport (18+ months validity).',
          'KNMC / professional council certificate (for healthcare).',
          'Police clearance certificate (PCC).',
          'Medical fitness (GAMCA for Gulf).',
          'Attested education + experience certificates.',
        ]} />
      </HubSection>

      <CtaLink href="/gulf-return">Returning from the Gulf? Gulf Return Hub →</CtaLink>
    </Hub>
  );
}
