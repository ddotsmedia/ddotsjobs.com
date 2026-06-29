import type { Metadata } from 'next';
import Link from 'next/link';
import { Hub, HubSection, Cards, Card } from '@/components/hub/HubShell';
import { CAREER_PATHS } from '@/lib/career-paths';

export const revalidate = 86400;
export const metadata: Metadata = {
  title: 'Career Paths in Kerala 2026 — Nursing, IT, Teaching & more | ddotsjobs.com',
  description:
    'Where can your career take you in Kerala? Salary-backed career progression paths for nursing, software, teaching, doctors, pharmacists, drivers, accountants and cooperative roles.',
  alternates: { canonical: 'https://ddotsjobs.com/career-paths' },
};

export default function CareerPathsIndex() {
  return (
    <Hub
      kicker="Career growth"
      title="Career Paths in Kerala"
      titleMl="Kerala-ലെ Career Paths"
      sub="Where can your career take you? Explore salary-backed progression paths for Kerala's top sectors."
    >
      <HubSection title="Choose your path">
        <Cards>
          {CAREER_PATHS.map((p) => (
            <Card key={p.slug} title={`${p.emoji} ${p.label}`} href={`/career-paths/${p.slug}`}>
              {p.sector} · {p.steps[0]?.salary.replace('/mo', '')} → {p.steps[p.steps.length - 1]?.salary.replace('/mo', '')}
            </Card>
          ))}
        </Cards>
      </HubSection>
      <p style={{ color: '#6b6860', fontSize: 14 }}>
        Looking for openings now? <Link href="/jobs" style={{ color: '#3A9EA5', fontWeight: 600 }}>Browse all jobs →</Link>
      </p>
    </Hub>
  );
}
