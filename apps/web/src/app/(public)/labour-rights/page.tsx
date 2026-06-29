import type { Metadata } from 'next';
import { Hub, HubSection, SalaryTable, Bullets, CtaLink } from '@/components/hub/HubShell';

export const revalidate = 86400;
export const metadata: Metadata = {
  title: 'Kerala Labour Law 2026 — Minimum Wages, Leave, PF, Rights | ddotsjobs.com',
  description:
    'Know your rights at work in Kerala — minimum wages 2026, working hours, leave entitlements, PF & ESI, termination & gratuity, women at work (POSH), and Gulf worker help. Malayalam + English.',
  alternates: { canonical: 'https://ddotsjobs.com/labour-rights' },
};

const p: React.CSSProperties = { color: '#3a3a34', fontSize: 15, lineHeight: 1.7, margin: '0 0 10px' };
const ml: React.CSSProperties = { color: '#6b6860', fontSize: 14, lineHeight: 1.7, margin: '0 0 10px' };

export default function LabourRightsPage() {
  return (
    <Hub
      kicker="Know your rights"
      title="Know Your Rights at Work"
      titleMl="ജോലിസ്ഥലത്തെ നിങ്ങളുടെ അവകാശങ്ങൾ"
      sub="Essential Kerala labour law guide — minimum wages, working hours, leave, PF, termination, and women's rights. In Malayalam and English."
    >
      <HubSection title="1 · Minimum wages in Kerala (2026)">
        <p style={p}>Kerala revises minimum wages by category and skill level. Indicative monthly figures (verify with the Kerala Labour Department for your exact scheduled employment):</p>
        <SalaryTable
          rows={[
            ['Unskilled', '₹16,000 – ₹19,000 / month'],
            ['Semi-skilled', '₹19,000 – ₹23,000 / month'],
            ['Skilled', '₹23,000 – ₹28,000 / month'],
            ['Clerical / supervisory', '₹25,000 – ₹35,000 / month'],
          ]}
        />
        <p style={ml}>വേതനം ഇതിലും കുറവാണെങ്കിൽ Kerala Labour Department-ൽ പരാതി നൽകാം.</p>
        <CtaLink href="https://wa.me/971509379212">Report a wage violation →</CtaLink>
      </HubSection>

      <HubSection title="2 · Working hours & overtime">
        <Bullets
          items={[
            'Maximum 8 hours/day and 48 hours/week.',
            'Overtime paid at 1.5× the regular wage.',
            'Rest break of at least 30 minutes after 5 hours of work.',
            'One full day off every week is mandatory.',
          ]}
        />
        <p style={ml}>ദിവസം 8 മണിക്കൂർ, ആഴ്ചയിൽ 48 മണിക്കൂർ — അധികസമയത്തിന് 1.5 മടങ്ങ് വേതനം.</p>
      </HubSection>

      <HubSection title="3 · Leave entitlements">
        <Bullets
          items={[
            'Annual leave: 1 day for every 20 days worked.',
            'Sick leave: up to 12 days per year.',
            'Maternity leave: 26 weeks (paid) under the Maternity Benefit Act.',
            'Paternity leave: ~15 days (varies by employer/policy).',
            'National & festival holidays: typically up to 14 days/year.',
          ]}
        />
      </HubSection>

      <HubSection title="4 · PF & ESI">
        <Bullets
          items={[
            'EPF: 12% employer + 12% employee contribution.',
            'ESI: applies for monthly salary under ₹21,000.',
            'Check your PF balance on the EPFO portal or by SMS/UMANG app.',
            'PF withdrawal/transfer is done online via the EPFO member portal.',
          ]}
        />
      </HubSection>

      <HubSection title="5 · Termination & gratuity">
        <Bullets
          items={[
            'Notice period as per your appointment letter (commonly 1 month).',
            'Gratuity after 5+ years of service: (15 × last drawn salary × years) ÷ 26.',
            'Wrongful termination can be challenged before the Labour Commissioner.',
          ]}
        />
        <p style={ml}>തെറ്റായ പിരിച്ചുവിടലിനെതിരെ Labour Commissioner-ന് പരാതി നൽകാം.</p>
      </HubSection>

      <HubSection title="6 · Women at work">
        <Bullets
          items={[
            'No night shift without the employee’s consent and safe transport.',
            'Workplace harassment is covered by the POSH Act — every workplace must have an Internal Complaints Committee.',
            'Full maternity benefits and equal pay for equal work.',
            'Kerala Women’s Commission helpline: 1091.',
          ]}
        />
      </HubSection>

      <HubSection title="7 · Gulf worker rights">
        <Bullets
          items={[
            'Keep a copy of your labour contract and visa; never hand over your passport.',
            'For unpaid salary, file with the UAE labour ministry (MOHRE) or your embassy.',
            'Indian Embassy Abu Dhabi & Consulate Dubai assist with labour disputes.',
            'NORKA-Roots helpline (Kerala): 1800 425 3939.',
          ]}
        />
        <CtaLink href="https://wa.me/971509379212">Get help with a Gulf labour issue →</CtaLink>
      </HubSection>

      <HubSection title="Report a violation">
        <p style={p}>Facing unpaid wages, unsafe conditions, or harassment? Message us — we can guide you to the right authority. You can stay anonymous.</p>
        <CtaLink href="https://wa.me/971509379212">WhatsApp us: +971 50 937 9212 →</CtaLink>
        <p style={{ ...ml, marginTop: 12 }}>This guide is general information, not legal advice. Verify current figures with the Kerala Labour Department.</p>
      </HubSection>
    </Hub>
  );
}
