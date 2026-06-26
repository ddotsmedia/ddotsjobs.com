import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerTrpc } from '@/lib/trpc/server';
import { CompletionRing } from '@/components/seeker/CompletionRing';
import { EXPERIENCE_OPTIONS, SEEKER_CATEGORIES, VISIBILITY_OPTIONS } from '@/lib/constants';
import { titleCase } from '@/lib/format';

export const metadata: Metadata = { title: 'My profile — ddotsjobs.com' };

function rupees(paise: number | null): string {
  if (paise == null) return '—';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}/mo`;
}
function expLabel(months: number | null): string {
  if (months == null) return '—';
  return EXPERIENCE_OPTIONS.find((o) => o.months === months)?.label ?? `${months} months`;
}
function catLabel(slug: string): string {
  return SEEKER_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export default async function ProfilePage() {
  const trpc = await getServerTrpc();
  const [profile, checklist] = await Promise.all([
    trpc.seeker.getProfile(),
    trpc.seeker.getCompletionChecklist(),
  ]);

  if (!profile) {
    return (
      <main style={s.page}>
        <div style={s.container}>
          <h1 style={s.h1}>My profile</h1>
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>You haven&rsquo;t set up your profile yet.</p>
            <Link href="/seeker/profile/setup" style={s.cta}>Set up your profile</Link>
          </div>
        </div>
      </main>
    );
  }

  const visibility = VISIBILITY_OPTIONS.find((v) => v.value === profile.visibility);
  const missing = checklist.filter((c) => !c.done);

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.headerRow}>
          <div>
            <h1 style={s.h1}>{profile.fullName ?? 'Your profile'}</h1>
            {profile.fullNameMl && <p style={s.sub}>{profile.fullNameMl}</p>}
            <p style={s.sub}>
              {profile.primaryProfession ?? '—'}
              {profile.homeDistrict ? ` · ${titleCase(profile.homeDistrict)}` : ''}
              {profile.isVerifiedProfessional ? ' · ✓ Verified professional' : ''}
            </p>
          </div>
          <CompletionRing pct={profile.completionPct} />
        </div>

        {missing.length > 0 && (
          <section style={s.checklist}>
            <h2 style={s.h2}>Complete your profile</h2>
            {missing.map((c) => (
              <Link key={c.item} href={c.link} style={s.checkItem}>
                <span>○ {c.item}</span>
                <span style={s.fix}>Fix →</span>
              </Link>
            ))}
          </section>
        )}

        <Section title="Basic info" editHref="/seeker/profile/setup">
          <Row label="Full name" value={profile.fullName ?? '—'} />
          <Row label="Malayalam name" value={profile.fullNameMl ?? '—'} />
          <Row label="District" value={profile.homeDistrict ? titleCase(profile.homeDistrict) : '—'} />
          <Row label="Profession" value={profile.primaryProfession ?? '—'} />
          <Row label="Language" value={profile.preferredLanguage === 'ml' ? 'Malayalam' : 'English'} />
        </Section>

        <Section title="Experience & salary" editHref="/seeker/profile/setup">
          <Row label="Experience" value={expLabel(profile.totalExperienceMonths)} />
          <Row label="Current employer" value={profile.currentEmployer ?? '—'} />
          <Row label="Salary expectation" value={`${rupees(profile.salaryMinPaise)}${profile.salaryMaxPaise ? ` – ${rupees(profile.salaryMaxPaise)}` : ''}`} />
          <Row label="Categories" value={profile.preferredCategories.map(catLabel).join(', ') || '—'} />
          <Row label="Job types" value={profile.preferredJobTypes.map((t) => titleCase(t)).join(', ') || '—'} />
        </Section>

        <Section title="Privacy" editHref="/seeker/profile/setup">
          <Row label="Visibility" value={visibility?.en ?? profile.visibility} />
          <Row label="Contact via platform only" value={profile.contactViaPlatformOnly ? 'Yes' : 'No'} />
          <Row label="Show current employer" value={profile.showCurrentEmployer ? 'Yes' : 'No'} />
          <Row label="Open to work" value={profile.isOpenToWork ? 'Yes' : 'No'} />
        </Section>
      </div>
    </main>
  );
}

function Section({ title, editHref, children }: { title: string; editHref: string; children: React.ReactNode }) {
  return (
    <section style={s.section}>
      <div style={s.sectionHead}>
        <h2 style={s.h2}>{title}</h2>
        <Link href={editHref} style={s.edit}>Edit</Link>
      </div>
      <div style={s.rows}>{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{value}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 720, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  headerRow: { display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.4rem)', margin: 0 },
  sub: { fontSize: 14, color: '#55554f', margin: '2px 0 0' },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' },
  cta: { padding: '10px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  checklist: { display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-2)', background: '#fdf3da', border: '1px solid #f0d999', borderRadius: 'var(--radius-card)' },
  checkItem: { display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', color: '#33332f' },
  fix: { color: 'var(--color-accent)', fontWeight: 600 },
  section: { padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', margin: 0 },
  edit: { fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' },
  rows: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: '1px solid #f4f4ef' },
  rowLabel: { fontSize: 13, color: '#6b6b66' },
  rowValue: { fontSize: 14, color: 'var(--color-dark)', textAlign: 'right', fontWeight: 500 },
};
