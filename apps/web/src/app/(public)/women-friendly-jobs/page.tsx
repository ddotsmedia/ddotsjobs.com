import type { Metadata } from 'next';
import { Hub, HubSection, Cards, Card, Bullets, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Jobs for Women in Kerala 2026 — ddotsjobs.com',
  description: 'Women-friendly jobs in Kerala — safe workplaces, flexible hours, transport provided. Kudumbashree links, safety resources and workplace rights.',
  alternates: { canonical: 'https://ddotsjobs.com/women-friendly-jobs' },
};

export default function WomenFriendlyJobsPage() {
  return (
    <Hub
      kicker="For women"
      title="Jobs for Women in Kerala"
      titleMl="Kerala-ലെ സ്ത്രീകൾക്കുള്ള ജോലികൾ"
      sub="60%+ of Kerala's job seekers are women. Find safe, flexible workplaces — with a women-friendly employer badge."
    >
      <HubSection title="What to look for">
        <Bullets items={[
          'Women-friendly employer badge (from verified employee reviews).',
          'Transport provided / women-only shift available.',
          'Flexible timing and no mandatory night shift.',
          'Crèche / childcare facility on site.',
        ]} />
      </HubSection>

      <HubSection title="Entrepreneurship & self-employment">
        <Cards>
          <Card title="Kudumbashree" href="https://kudumbashree.org">State women&rsquo;s network — jobs &amp; micro-enterprise.</Card>
          <Card title="Women cooperative jobs" href="/cooperative-jobs">Cooperative sector roles.</Card>
          <Card title="Self-employment schemes">NORKA / state startup support.</Card>
        </Cards>
      </HubSection>

      <HubSection title="Safety & rights">
        <Bullets items={[
          'Kerala Women’s Commission — grievance redressal.',
          'Workplace harassment: every employer must have an Internal Committee (PoSH Act).',
          'You have a legal right to equal pay and a safe workplace.',
        ]} />
      </HubSection>

      <CtaLink href="/jobs">Browse jobs →</CtaLink>
    </Hub>
  );
}
