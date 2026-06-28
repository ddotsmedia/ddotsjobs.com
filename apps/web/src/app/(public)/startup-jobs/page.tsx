import type { Metadata } from 'next';
import { Hub, HubSection, Cards, Card, Bullets, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Startup Jobs in Kerala 2026 — KSUM | ddotsjobs.com',
  description: "Work at Kerala's fastest-growing startups. KSUM ecosystem, Startup Village Kochi, Technopark & Infopark incubators. Equity, flexible culture, growth.",
  alternates: { canonical: 'https://ddotsjobs.com/startup-jobs' },
};

export default function StartupJobsPage() {
  return (
    <Hub
      kicker="Startups"
      title="Startup Jobs in Kerala"
      titleMl="കേരളത്തിലെ Startup ജോലികൾ"
      sub="Grow with Kerala's fastest startups — learning, equity and a flexible culture."
    >
      <HubSection title="Kerala startup ecosystem">
        <Cards>
          <Card title="Kerala Startup Mission (KSUM)" href="https://startupmission.kerala.gov.in">1000+ startups supported by the state.</Card>
          <Card title="Startup Village, Kochi">Co-working + incubation.</Card>
          <Card title="Technopark incubators" href="/technopark-jobs">Trivandrum tech startups.</Card>
          <Card title="Infopark startup section" href="/infopark-jobs">Kochi startup hub.</Card>
        </Cards>
      </HubSection>

      <HubSection title="Why work at a startup">
        <Bullets items={[
          'Steeper learning curve — own real outcomes early.',
          'Equity / ESOP upside on top of salary.',
          'Flexible, modern work culture.',
          'Fast career growth as the company scales.',
        ]} />
      </HubSection>

      <CtaLink href="/jobs?category=it">Browse startup & tech jobs →</CtaLink>
    </Hub>
  );
}
