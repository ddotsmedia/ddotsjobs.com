import type { Metadata } from 'next';
import { Hub, HubSection, Cards, Card, Bullets, SalaryTable, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 60;
export const metadata: Metadata = {
  title: 'Fresher Jobs Kerala 2026 — Your First Job | ddotsjobs.com',
  description:
    'Fresher & entry-level jobs in Kerala (0 experience) — nursing, IT, teaching, accounting, retail. First CV tips, interview prep, realistic first-salary guide, and campus recruitment.',
  alternates: { canonical: 'https://ddotsjobs.com/fresher-jobs' },
};

export default function FresherJobsPage() {
  return (
    <Hub
      kicker="Start your career"
      title="Your First Job in Kerala"
      titleMl="നിങ്ങളുടെ ആദ്യ ജോലി"
      sub="Entry-level and zero-experience roles across Kerala, plus everything you need to land your first job with confidence."
    >
      <HubSection title="Fresher jobs by sector">
        <Cards>
          <Card title="Nursing (GNM/BSc)" href="/jobs?category=nursing">Fresher staff nurse roles</Card>
          <Card title="IT / Software" href="/jobs?category=it">Junior developer & trainee</Card>
          <Card title="Teaching" href="/jobs?category=teaching">Primary & assistant teacher</Card>
          <Card title="Accounting" href="/jobs?category=accounting">Junior accountant (Tally/GST)</Card>
          <Card title="Retail & Sales" href="/jobs">Store & customer roles</Card>
          <Card title="All entry-level" href="/jobs">Browse every fresher job</Card>
        </Cards>
      </HubSection>

      <HubSection title="Realistic first-salary guide">
        <SalaryTable
          rows={[
            ['Fresh BSc / GNM Nurse', '₹18,000 – 22,000 / mo'],
            ['Fresh Software Developer', '₹20,000 – 35,000 / mo'],
            ['Fresh Primary Teacher', '₹18,000 – 28,000 / mo'],
            ['Fresh Junior Accountant', '₹15,000 – 22,000 / mo'],
            ['Fresh Retail / Sales', '₹12,000 – 18,000 / mo'],
          ]}
        />
      </HubSection>

      <HubSection title="Fresher guides">
        <Bullets
          items={[
            'How to write your first CV: keep it 1 page, lead with education + skills + any internships.',
            'What to wear for an interview: clean formals, minimal accessories, arrive 15 minutes early.',
            'Questions to ask the interviewer: role expectations, training, growth path, work timings.',
            'Carry originals + copies of certificates, ID, and passport photos to walk-ins.',
          ]}
        />
      </HubSection>

      <HubSection title="Internships & campus recruitment">
        <p style={{ color: '#3a3a34', fontSize: 15, lineHeight: 1.7 }}>
          Many Kerala employers run internships and campus drives. Check the events calendar for upcoming campus recruitment near you.
        </p>
        <CtaLink href="/jobs?type=internship">Browse internships →</CtaLink>
      </HubSection>

      <HubSection title="Walk-in interviews for freshers">
        <p style={{ color: '#3a3a34', fontSize: 15, lineHeight: 1.7 }}>
          Walk-ins are the fastest route to a first job — no long online process. Bring your documents and show up.
        </p>
        <CtaLink href="/jobs?type=walk_in">See walk-in jobs →</CtaLink>
      </HubSection>
    </Hub>
  );
}
