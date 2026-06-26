'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import {
  DISTRICTS,
  EXPERIENCE_OPTIONS,
  PROFESSIONS,
  SEEKER_CATEGORIES,
  SEEKER_JOB_TYPES,
  VISIBILITY_OPTIONS,
} from '@/lib/constants';

type District = (typeof DISTRICTS)[number]['value'];
type Visibility = 'private' | 'selective' | 'open';

interface State {
  fullName: string;
  fullNameMl: string;
  primaryDistrict: District | '';
  primaryProfession: string;
  preferredLanguage: 'ml' | 'en';
  totalExperienceMonths: number;
  currentEmployer: string;
  salaryMin: number; // rupees
  salaryMax: number; // rupees
  noMax: boolean;
  categories: Set<string>;
  jobTypes: Set<string>;
  visibility: Visibility;
  contactViaPlatformOnly: boolean;
  showCurrentEmployer: boolean;
}

export function ProfileSetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [st, setSt] = useState<State>({
    fullName: '',
    fullNameMl: '',
    primaryDistrict: '',
    primaryProfession: '',
    preferredLanguage: 'ml',
    totalExperienceMonths: 0,
    currentEmployer: '',
    salaryMin: 15000,
    salaryMax: 40000,
    noMax: false,
    categories: new Set(),
    jobTypes: new Set(),
    visibility: 'selective',
    contactViaPlatformOnly: true,
    showCurrentEmployer: false,
  });

  const save = trpc.seeker.updateProfile.useMutation({
    onSuccess: () => router.push('/seeker/dashboard?toast=profile_created'),
  });

  function set<K extends keyof State>(key: K, value: State[K]) {
    setSt((s) => ({ ...s, [key]: value }));
  }
  function toggleSet(key: 'categories' | 'jobTypes', value: string) {
    setSt((s) => {
      const next = new Set(s[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...s, [key]: next };
    });
  }

  const step1Valid = st.fullName.trim().length >= 2 && st.primaryDistrict && st.primaryProfession;
  const step2Valid = st.categories.size >= 1;

  function submit() {
    save.mutate({
      fullName: st.fullName.trim(),
      fullNameMl: st.fullNameMl.trim() || undefined,
      primaryDistrict: st.primaryDistrict || undefined,
      primaryProfession: st.primaryProfession || undefined,
      preferredLanguage: st.preferredLanguage,
      totalExperienceMonths: st.totalExperienceMonths,
      currentEmployer: st.currentEmployer.trim() || undefined,
      salaryMinPaise: st.salaryMin * 100,
      salaryMaxPaise: st.noMax ? undefined : st.salaryMax * 100,
      preferredCategories: [...st.categories],
      preferredJobTypes: [...st.jobTypes],
      visibility: st.visibility,
      contactViaPlatformOnly: st.contactViaPlatformOnly,
      showCurrentEmployer: st.showCurrentEmployer,
      isOpenToWork: true,
    });
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.dots}>
          {[1, 2, 3].map((n) => (
            <span key={n} style={{ ...s.dot, background: n <= step ? 'var(--color-brand)' : '#e2e2dc' }} />
          ))}
        </div>
        <p style={s.stepLabel}>Step {step} of 3</p>

        {step === 1 && (
          <section style={s.card}>
            <h2 style={s.h2}>Basic info</h2>
            <Field label="Full name (English)">
              <input value={st.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Meera Pradeep" style={s.input} />
            </Field>
            <Field label="Full name (Malayalam)" hint="ഉദാ: മീര പ്രദീപ്">
              <input value={st.fullNameMl} onChange={(e) => set('fullNameMl', e.target.value)} style={s.input} />
            </Field>
            <Field label="Primary district">
              <select value={st.primaryDistrict} onChange={(e) => set('primaryDistrict', e.target.value as District)} style={s.input}>
                <option value="">Select district</option>
                {DISTRICTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Primary profession">
              <select value={st.primaryProfession} onChange={(e) => set('primaryProfession', e.target.value)} style={s.input}>
                <option value="">Select profession</option>
                {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Preferred language">
              <div style={s.toggleRow}>
                {(['ml', 'en'] as const).map((l) => (
                  <button key={l} type="button" onClick={() => set('preferredLanguage', l)}
                    style={{ ...s.toggleBtn, ...(st.preferredLanguage === l ? s.toggleOn : {}) }}>
                    {l === 'ml' ? 'Malayalam' : 'English'}
                  </button>
                ))}
              </div>
            </Field>
            <button type="button" disabled={!step1Valid} onClick={() => setStep(2)} style={{ ...s.primary, opacity: step1Valid ? 1 : 0.5 }}>
              Next →
            </button>
          </section>
        )}

        {step === 2 && (
          <section style={s.card}>
            <h2 style={s.h2}>Experience &amp; salary</h2>
            <Field label="Total experience">
              <div style={s.radioWrap}>
                {EXPERIENCE_OPTIONS.map((o) => (
                  <label key={o.months} style={s.radio}>
                    <input type="radio" name="exp" checked={st.totalExperienceMonths === o.months} onChange={() => set('totalExperienceMonths', o.months)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Current employer (optional)">
              <input value={st.currentEmployer} onChange={(e) => set('currentEmployer', e.target.value)} style={s.input} />
            </Field>
            <Field label={`Minimum salary — ₹${st.salaryMin.toLocaleString('en-IN')}/mo`}>
              <input type="range" min={10000} max={100000} step={1000} value={st.salaryMin}
                onChange={(e) => set('salaryMin', Number(e.target.value))} style={s.slider} />
            </Field>
            <Field label={st.noMax ? 'Maximum salary — No maximum' : `Maximum salary — ₹${st.salaryMax.toLocaleString('en-IN')}/mo`}>
              <input type="range" min={10000} max={100000} step={1000} value={st.salaryMax} disabled={st.noMax}
                onChange={(e) => set('salaryMax', Math.max(Number(e.target.value), st.salaryMin))} style={s.slider} />
              <label style={s.check}>
                <input type="checkbox" checked={st.noMax} onChange={(e) => set('noMax', e.target.checked)} /> No maximum
              </label>
            </Field>
            <Field label="Preferred job categories (min 1)">
              <div style={s.chips}>
                {SEEKER_CATEGORIES.map((c) => {
                  const on = st.categories.has(c.slug);
                  return (
                    <button key={c.slug} type="button" onClick={() => toggleSet('categories', c.slug)}
                      style={{ ...s.chip, ...(on ? s.chipOn : {}) }}>{c.label}</button>
                  );
                })}
              </div>
            </Field>
            <Field label="Preferred job types">
              <div style={s.checkWrap}>
                {SEEKER_JOB_TYPES.map((t) => (
                  <label key={t.value} style={s.check}>
                    <input type="checkbox" checked={st.jobTypes.has(t.value)} onChange={() => toggleSet('jobTypes', t.value)} /> {t.label}
                  </label>
                ))}
              </div>
            </Field>
            <div style={s.btnRow}>
              <button type="button" onClick={() => setStep(1)} style={s.secondary}>← Back</button>
              <button type="button" disabled={!step2Valid} onClick={() => setStep(3)} style={{ ...s.primary, flex: 1, opacity: step2Valid ? 1 : 0.5 }}>Next →</button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section style={s.card}>
            <h2 style={s.h2}>Who can see your profile?</h2>
            <div style={s.visWrap}>
              {VISIBILITY_OPTIONS.map((v) => (
                <label key={v.value} style={{ ...s.visOption, ...(st.visibility === v.value ? s.visOn : {}) }}>
                  <input type="radio" name="vis" checked={st.visibility === v.value} onChange={() => set('visibility', v.value as Visibility)} />
                  <span>
                    <span style={s.visEn}>{v.en}</span>
                    <span style={s.visMl}>{v.ml}</span>
                  </span>
                </label>
              ))}
            </div>

            <label style={s.toggleLine}>
              <input type="checkbox" checked={st.contactViaPlatformOnly} onChange={(e) => set('contactViaPlatformOnly', e.target.checked)} />
              <span>
                <strong>Contact me through platform only</strong>
                <span style={s.muted}>My phone number is never shared · എന്റെ phone number share ചെയ്യില്ല</span>
              </span>
            </label>
            <label style={s.toggleLine}>
              <input type="checkbox" checked={st.showCurrentEmployer} onChange={(e) => set('showCurrentEmployer', e.target.checked)} />
              <span><strong>Show my current employer on profile</strong></span>
            </label>

            {save.error && <p style={s.err}>{save.error.message}</p>}
            <div style={s.btnRow}>
              <button type="button" onClick={() => setStep(2)} style={s.secondary}>← Back</button>
              <button type="button" disabled={save.isPending} onClick={submit} style={{ ...s.primary, flex: 1 }}>
                {save.isPending ? 'Saving…' : 'Complete Profile ✓'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={s.field}>
      <span style={s.label}>{label}</span>
      {hint && <span style={s.hint}>{hint}</span>}
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 560, margin: '0 auto', padding: 'var(--space-3) var(--space-2)' },
  dots: { display: 'flex', gap: 8, justifyContent: 'center' },
  dot: { width: 40, height: 6, borderRadius: 999 },
  stepLabel: { textAlign: 'center', fontSize: 13, color: '#6b6b66', margin: 'var(--space-1) 0 var(--space-2)' },
  card: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem', margin: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 600, color: '#33332f' },
  hint: { fontSize: 13, color: '#9a9a92' },
  input: { height: 48, padding: '0 12px', fontSize: 16, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', outline: 'none' },
  slider: { width: '100%', height: 28, accentColor: '#f5a800' },
  toggleRow: { display: 'flex', gap: 8 },
  toggleBtn: { flex: 1, minHeight: 44, fontSize: 15, fontWeight: 600, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  toggleOn: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  radioWrap: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 6 },
  radio: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, minHeight: 40 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, padding: '0 16px', fontSize: 14, fontWeight: 500, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  chipOn: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  checkWrap: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' },
  check: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, minHeight: 40 },
  visWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  visOption: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: 'var(--space-2)', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', cursor: 'pointer' },
  visOn: { borderColor: 'var(--color-accent)', background: '#eef6f5' },
  visEn: { display: 'block', fontSize: 14, fontWeight: 600 },
  visMl: { display: 'block', fontSize: 13, color: '#55554f' },
  toggleLine: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14 },
  muted: { display: 'block', fontSize: 12, color: '#9a9a92', marginTop: 2 },
  err: { color: '#c0392b', fontSize: 13 },
  btnRow: { display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' },
  primary: { minHeight: 48, padding: '0 20px', fontSize: 16, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  secondary: { minHeight: 48, padding: '0 18px', fontSize: 15, fontWeight: 600, color: '#55554f', background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
};
