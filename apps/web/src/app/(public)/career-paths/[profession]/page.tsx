import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Hub, HubSection, CtaLink } from '@/components/hub/HubShell';
import { CAREER_PATHS, getCareerPath } from '@/lib/career-paths';

export const revalidate = 86400;
export function generateStaticParams() {
  return CAREER_PATHS.map((p) => ({ profession: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ profession: string }> }): Promise<Metadata> {
  const { profession } = await params;
  const path = getCareerPath(profession);
  if (!path) return { title: 'Career Path — ddotsjobs.com' };
  return {
    title: `${path.label} Career Path Kerala 2026 — Salary & Growth | ddotsjobs.com`,
    description: `${path.label} career path in Kerala: salary progression from fresher to senior, certifications needed, specialisations, and live jobs. ${path.intro.slice(0, 80)}`,
    alternates: { canonical: `https://ddotsjobs.com/career-paths/${path.slug}` },
  };
}

const node: React.CSSProperties = { background: '#fff', border: '1px solid #efefe9', borderRadius: 14, padding: '16px 18px' };

export default async function CareerPathPage({ params }: { params: Promise<{ profession: string }> }) {
  const { profession } = await params;
  const path = getCareerPath(profession);
  if (!path) notFound();

  return (
    <Hub
      kicker={path.sector}
      title={`${path.label} Career Path`}
      titleMl={`${path.labelMl} — Career Path`}
      sub={path.intro}
    >
      <HubSection title="Progression & salary">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {path.steps.map((step, i) => (
            <div key={i}>
              <div style={node}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <strong style={{ color: '#1A1916', fontSize: 16 }}>{step.title}</strong>
                  <span style={{ color: '#3A9EA5', fontWeight: 700 }}>{step.salary}</span>
                </div>
                <div style={{ color: '#6b6860', fontSize: 13, marginTop: 4 }}>
                  {step.exp}{step.certs ? ` · ${step.certs}` : ''}
                </div>
              </div>
              {i < path.steps.length - 1 && <div style={{ textAlign: 'center', color: '#8DC63F', fontSize: 20, lineHeight: '24px' }}>↓</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <CtaLink href={path.jobsQuery}>View {path.label} jobs →</CtaLink>
        </div>
      </HubSection>

      {path.specializations && (
        <HubSection title="Specialisation options">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {path.specializations.map((sp) => (
              <span key={sp.label} style={{ background: '#F4F3EE', borderRadius: 10, padding: '8px 12px', fontSize: 14, color: '#1A1916' }}>
                <strong>{sp.label}</strong> <span style={{ color: '#6b6860' }}>· {sp.benefit}</span>
              </span>
            ))}
          </div>
        </HubSection>
      )}

      {path.gulf && (
        <HubSection title="Gulf opportunities">
          <p style={{ color: '#3a3a34', fontSize: 15, lineHeight: 1.7 }}>{path.gulf.note} Average Gulf pay: <strong>{path.gulf.salary}</strong>.</p>
          <CtaLink href="/overseas-jobs">Explore overseas jobs →</CtaLink>
        </HubSection>
      )}

      <HubSection title="More paths">
        <p style={{ color: '#6b6860', fontSize: 14 }}>
          {CAREER_PATHS.filter((p) => p.slug !== path.slug).slice(0, 5).map((p, i) => (
            <span key={p.slug}>
              {i > 0 ? ' · ' : ''}
              <Link href={`/career-paths/${p.slug}`} style={{ color: '#3A9EA5' }}>{p.label}</Link>
            </span>
          ))}
        </p>
      </HubSection>
    </Hub>
  );
}
