'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES_UI, DISTRICTS, JOB_TYPES_UI, SALARY_MAX_RUPEES, SALARY_MIN_RUPEES, SALARY_STEP_RUPEES } from '@/lib/constants';
import { filtersToQuery, type JobFilters } from '@/lib/jobFilters';

export function FilterPanel({
  initial,
  onApplied,
}: {
  initial: JobFilters;
  onApplied?: () => void;
}) {
  const router = useRouter();
  const [salary, setSalary] = useState<number>(
    initial.salaryMin ? Math.round(initial.salaryMin / 100) : SALARY_MIN_RUPEES,
  );

  function apply(next: JobFilters) {
    const qs = filtersToQuery(next);
    router.push(qs ? `/jobs?${qs}` : '/jobs');
    onApplied?.();
  }

  function toggleIn(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  return (
    <div style={s.panel}>
      <Section title="Category">
        {CATEGORIES_UI.map((c) => (
          <Check
            key={c.slug}
            label={c.label}
            checked={initial.categories.includes(c.slug)}
            onChange={() => apply({ ...initial, categories: toggleIn(initial.categories, c.slug) })}
          />
        ))}
      </Section>

      <Section title="District">
        {DISTRICTS.map((d) => (
          <Check
            key={d.value}
            label={d.label}
            checked={initial.districts.includes(d.value)}
            onChange={() => apply({ ...initial, districts: toggleIn(initial.districts, d.value) })}
          />
        ))}
      </Section>

      <Section title="Job type">
        {JOB_TYPES_UI.map((t) => (
          <Check
            key={t.value}
            label={t.label}
            checked={initial.jobTypes.includes(t.value)}
            onChange={() => apply({ ...initial, jobTypes: toggleIn(initial.jobTypes, t.value) })}
          />
        ))}
      </Section>

      <Section title="Minimum salary">
        <div style={s.salaryVal}>₹{salary.toLocaleString('en-IN')}/mo</div>
        <input
          type="range"
          min={SALARY_MIN_RUPEES}
          max={SALARY_MAX_RUPEES}
          step={SALARY_STEP_RUPEES}
          value={salary}
          onChange={(e) => setSalary(Number(e.target.value))}
          onPointerUp={() =>
            apply({
              ...initial,
              salaryMin: salary <= SALARY_MIN_RUPEES ? undefined : salary * 100,
            })
          }
          aria-label="Minimum salary"
          style={s.slider}
        />
      </Section>

      <Section title="More">
        <Check
          label="Walk-in only"
          checked={initial.isWalkIn}
          onChange={() => apply({ ...initial, isWalkIn: !initial.isWalkIn })}
        />
        <Check
          label="Gulf Return friendly"
          checked={initial.valuesGulfExperience}
          onChange={() => apply({ ...initial, valuesGulfExperience: !initial.valuesGulfExperience })}
        />
        <Check
          label="Salary disclosed only"
          checked={initial.salaryDisclosed}
          onChange={() => apply({ ...initial, salaryDisclosed: !initial.salaryDisclosed })}
        />
      </Section>

      <button type="button" onClick={() => apply(emptyFilters(initial.sort))} style={s.clear}>
        Clear filters
      </button>
    </div>
  );
}

function emptyFilters(sort: JobFilters['sort']): JobFilters {
  return {
    districts: [],
    categories: [],
    jobTypes: [],
    isWalkIn: false,
    valuesGulfExperience: false,
    salaryDisclosed: false,
    sort,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <h3 style={s.sectionTitle}>{title}</h3>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label style={s.check}>
      <input type="checkbox" checked={checked} onChange={onChange} style={s.checkbox} />
      <span>{label}</span>
    </label>
  );
}

const s: Record<string, React.CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' },
  section: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  sectionTitle: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b6b66', fontFamily: 'var(--font-sans)', fontStyle: 'normal' },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 6 },
  check: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, minHeight: 32, cursor: 'pointer' },
  checkbox: { width: 18, height: 18, accentColor: '#007d77' },
  salaryVal: { fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' },
  slider: { width: '100%', accentColor: '#f5a800', height: 28 },
  clear: { alignSelf: 'flex-start', fontSize: 14, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
};
