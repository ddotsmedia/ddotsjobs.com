'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { DISTRICTS, JOB_CATEGORIES, JOB_CERTS, JOB_EXPERIENCE, JOB_POST_TYPES } from '@/lib/constants';

type District = (typeof DISTRICTS)[number]['value'];
type JType = (typeof JOB_POST_TYPES)[number]['value'];

function plus30(): string {
  const d = new Date(Date.now() + 30 * 86_400_000);
  return d.toISOString().slice(0, 10);
}
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function JobPostForm() {
  const parks = trpc.itParks.list.useQuery();
  const create = trpc.jobs.create.useMutation();
  const autoFill = trpc.jobs.autoFillDescription.useMutation();
  const suggestTitles = trpc.jobs.suggestTitles.useMutation();
  const benchmark = trpc.jobs.salaryBenchmark.useMutation();
  const [showTitleSug, setShowTitleSug] = useState(false);

  const [title, setTitle] = useState('');
  const [titleMl, setTitleMl] = useState('');
  const [category, setCategory] = useState('nursing');
  const [district, setDistrict] = useState<District>('thiruvananthapuram');
  const [jobType, setJobType] = useState<JType>('full_time');
  const [description, setDescription] = useState('');
  const [descriptionMl, setDescriptionMl] = useState('');
  const [requirements, setRequirements] = useState('');
  const [languageRequirement, setLanguageRequirement] = useState<'ml' | 'en' | 'both'>('both');
  const [minExperienceMonths, setMinExp] = useState(0);
  const [certs, setCerts] = useState<Set<string>>(new Set());
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryDisclosed, setSalaryDisclosed] = useState(true);
  const [walkInToggle, setWalkInToggle] = useState(false);
  const [walkInStart, setWalkInStart] = useState('');
  const [walkInEnd, setWalkInEnd] = useState('');
  const [walkInVenue, setWalkInVenue] = useState('');
  const [walkInVenueMl, setWalkInVenueMl] = useState('');
  const [walkInDocsMl, setWalkInDocsMl] = useState('');
  const [valuesGulf, setValuesGulf] = useState(false);
  const [itParkId, setItParkId] = useState('');
  const [employerQuestion, setEmployerQuestion] = useState('');
  const [validThrough, setValidThrough] = useState(plus30());

  const isWalkIn = jobType === 'walk_in' || walkInToggle;

  async function doAutoFill() {
    const res = await autoFill.mutateAsync({ title: title.trim(), category, district, language: languageRequirement });
    if (res) {
      setDescription(res.description_en);
      if (res.description_ml) setDescriptionMl(res.description_ml);
    }
  }

  function onTitleBlur() {
    if (title.trim().length < 2) return;
    suggestTitles.mutate({ partialTitle: title.trim(), category }, { onSuccess: () => setShowTitleSug(true) });
  }
  function loadBenchmark() {
    benchmark.mutate({ category, district, experienceMin: Math.floor(minExperienceMonths / 12) });
  }
  function useMarketRate() {
    const b = benchmark.data;
    if (!b || b.minPaise === 0) return;
    setSalaryMin(String(Math.round(b.minPaise / 100)));
    setSalaryMax(String(Math.round(b.maxPaise / 100)));
  }

  function toggleCert(c: string) {
    setCerts((p) => {
      const n = new Set(p);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  }

  function submit() {
    create.mutate({
      title: title.trim(),
      titleMl: titleMl.trim() || undefined,
      category,
      district,
      jobType,
      description: description.trim(),
      descriptionMl: descriptionMl.trim() || undefined,
      requirements: requirements.trim() || undefined,
      languageRequirement,
      minExperienceMonths,
      requiredCertifications: [...certs].map((c) => c.toLowerCase()),
      salaryMinPaise: salaryMin ? Number(salaryMin) * 100 : undefined,
      salaryMaxPaise: salaryMax ? Number(salaryMax) * 100 : undefined,
      salaryDisclosed,
      isWalkIn,
      walkInStartAt: isWalkIn ? toIso(walkInStart) : undefined,
      walkInEndAt: isWalkIn ? toIso(walkInEnd) : undefined,
      walkInVenue: isWalkIn ? walkInVenue.trim() || undefined : undefined,
      walkInVenueMl: isWalkIn ? walkInVenueMl.trim() || undefined : undefined,
      walkInDocumentsMl: isWalkIn ? walkInDocsMl.trim() || undefined : undefined,
      valuesGulfExperience: valuesGulf,
      employerQuestion: employerQuestion.trim() || undefined,
      validThrough: toIso(`${validThrough}T23:59`),
      itParkId: itParkId || undefined,
    });
  }

  if (create.isSuccess) {
    const active = create.data.status === 'active';
    return (
      <div style={s.success}>
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>{active ? 'Job posted successfully' : 'Job submitted for review'}</h2>
        <p style={s.successSub}>
          {active
            ? 'Your job is live. Matching candidates will be notified on WhatsApp.'
            : 'Our team will review within a few hours.'}
        </p>
        <div style={s.successBtns}>
          <a href="/employer/jobs/new" style={s.secondary}>Post another job</a>
          {active && <Link href={`/jobs/${create.data.slug}`} style={s.primary}>View job</Link>}
        </div>
      </div>
    );
  }

  const noSalary = !salaryMin && !salaryMax;
  const canSubmit = title.trim().length >= 3 && description.trim().length >= 50 && !create.isPending;

  return (
    <div style={s.form}>
      {/* Section 1 */}
      <Section title="Job details">
        <Field label="Job title (English)" required>
          <input value={title} onChange={(e) => { setTitle(e.target.value); setShowTitleSug(false); }} onBlur={onTitleBlur} placeholder="e.g. Staff Nurse — ICU" style={s.input} />
          {suggestTitles.isPending && <p style={s.aiHint}>✨ AI thinking…</p>}
          {showTitleSug && (suggestTitles.data?.titles.length ?? 0) > 0 && (
            <div style={s.sugBox}>
              <span style={s.sugLabel}>Suggested titles</span>
              {suggestTitles.data!.titles.map((t) => (
                <button key={t} type="button" onMouseDown={() => { setTitle(t); setShowTitleSug(false); }} style={s.sugItem}>{t}</button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Job title (Malayalam)">
          <input value={titleMl} onChange={(e) => setTitleMl(e.target.value)} placeholder="e.g. സ്റ്റാഫ് നഴ്‌സ് — ICU" style={s.input} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={s.input}>
            {JOB_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="District">
          <select value={district} onChange={(e) => setDistrict(e.target.value as District)} style={s.input}>
            {DISTRICTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Job type">
          <select value={jobType} onChange={(e) => setJobType(e.target.value as JType)} style={s.input}>
            {JOB_POST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </Section>

      {/* Section 2 */}
      <Section title="Description">
        <div style={s.field}>
          <div style={s.descHead}>
            <span style={s.label}>Description (English) <span style={{ color: '#c0392b' }}>*</span></span>
            <button type="button" disabled={!title.trim() || autoFill.isPending} onClick={doAutoFill} style={s.autoFill}>
              {autoFill.isPending ? 'Filling…' : '✨ Auto-fill'}
            </button>
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Describe the role (min 50 characters)" style={s.textarea} />
          <span style={s.counter}>{description.length} chars{description.length < 50 ? ' (min 50)' : ''}</span>
        </div>
        <Field label="Description (Malayalam)">
          <textarea value={descriptionMl} onChange={(e) => setDescriptionMl(e.target.value)} rows={4} style={s.textarea} />
        </Field>
        <Field label="Requirements">
          <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={3} style={s.textarea} />
        </Field>
        <Field label="Language requirement">
          <div style={s.radioRow}>
            {([['ml', 'Malayalam only'], ['en', 'English only'], ['both', 'Both']] as const).map(([v, l]) => (
              <label key={v} style={s.radio}>
                <input type="radio" name="lang" checked={languageRequirement === v} onChange={() => setLanguageRequirement(v)} /> {l}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Minimum experience">
          <select value={minExperienceMonths} onChange={(e) => setMinExp(Number(e.target.value))} style={s.input}>
            {JOB_EXPERIENCE.map((x) => <option key={x.months} value={x.months}>{x.label}</option>)}
          </select>
        </Field>
        <Field label="Required certifications">
          <div style={s.checkWrap}>
            {JOB_CERTS.map((c) => (
              <label key={c} style={s.check}><input type="checkbox" checked={certs.has(c)} onChange={() => toggleCert(c)} /> {c}</label>
            ))}
          </div>
        </Field>
      </Section>

      {/* Section 3 */}
      <Section title="Salary">
        <div style={s.benchBar}>
          <button type="button" onClick={loadBenchmark} disabled={benchmark.isPending} style={s.benchBtn}>
            {benchmark.isPending ? 'Checking market…' : '✨ AI salary benchmark'}
          </button>
          {benchmark.data && benchmark.data.minPaise > 0 && (
            <span style={s.benchHint}>
              Market rate: ₹{Math.round(benchmark.data.minPaise / 100).toLocaleString('en-IN')}–₹{Math.round(benchmark.data.maxPaise / 100).toLocaleString('en-IN')}/mo ({benchmark.data.confidence}, ~{benchmark.data.sampleSize} jobs) ·{' '}
              <button type="button" onClick={useMarketRate} style={s.benchUse}>Use this</button>
            </span>
          )}
        </div>
        <Field label="Salary minimum (₹/month)">
          <input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="20000" style={s.input} />
        </Field>
        <Field label="Salary maximum (₹/month)">
          <input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="optional" style={s.input} />
        </Field>
        <label style={s.toggleLine}>
          <input type="checkbox" checked={salaryDisclosed} onChange={(e) => setSalaryDisclosed(e.target.checked)} />
          <span>{salaryDisclosed ? 'Show salary to job seekers' : 'Show market rate instead'}</span>
        </label>
        {noSalary && <span style={s.warn}>No salary = fewer applications.</span>}
      </Section>

      {/* Section 4 — walk-in */}
      <Section title="Walk-in">
        {jobType !== 'walk_in' && (
          <label style={s.toggleLine}>
            <input type="checkbox" checked={walkInToggle} onChange={(e) => setWalkInToggle(e.target.checked)} />
            <span>This is a walk-in interview</span>
          </label>
        )}
        {isWalkIn && (
          <>
            <Field label="Walk-in date & time" required>
              <input type="datetime-local" value={walkInStart} onChange={(e) => setWalkInStart(e.target.value)} style={s.input} />
            </Field>
            <Field label="End time">
              <input type="datetime-local" value={walkInEnd} onChange={(e) => setWalkInEnd(e.target.value)} style={s.input} />
            </Field>
            <Field label="Venue (English)">
              <input value={walkInVenue} onChange={(e) => setWalkInVenue(e.target.value)} style={s.input} />
            </Field>
            <Field label="Venue (Malayalam)">
              <input value={walkInVenueMl} onChange={(e) => setWalkInVenueMl(e.target.value)} style={s.input} />
            </Field>
            <Field label="Documents required (Malayalam)">
              <textarea value={walkInDocsMl} onChange={(e) => setWalkInDocsMl(e.target.value)} rows={2} placeholder="KNMC Registration, Degree Certificate, Photo ID" style={s.textarea} />
            </Field>
          </>
        )}
      </Section>

      {/* Section 5 */}
      <Section title="Additional">
        <label style={s.toggleLine}>
          <input type="checkbox" checked={valuesGulf} onChange={(e) => setValuesGulf(e.target.checked)} />
          <span>Gulf Return friendly</span>
        </label>
        <Field label="IT Park">
          <select value={itParkId} onChange={(e) => setItParkId(e.target.value)} style={s.input}>
            <option value="">None</option>
            {(parks.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Employer question" hint="Ask candidates one question before they apply">
          <input value={employerQuestion} onChange={(e) => setEmployerQuestion(e.target.value.slice(0, 500))} placeholder="What shift availability do you have?" style={s.input} />
        </Field>
        <Field label="Valid through" hint="Google requires this for job listings">
          <input type="date" value={validThrough} onChange={(e) => setValidThrough(e.target.value)} style={s.input} />
        </Field>
      </Section>

      {create.error && <p style={s.err}>{create.error.message}</p>}
      <button type="button" disabled={!canSubmit} onClick={submit} style={{ ...s.submit, opacity: canSubmit ? 1 : 0.6 }}>
        {create.isPending ? 'Publishing…' : 'Post Job'}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={s.section}><h2 style={s.h2}>{title}</h2>{children}</section>;
}
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={s.field}>
      <span style={s.label}>{label}{required && <span style={{ color: '#c0392b' }}> *</span>}</span>
      {hint && <span style={s.hint}>{hint}</span>}
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  section: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', margin: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 600, color: '#33332f' },
  hint: { fontSize: 12, color: '#9a9a92' },
  input: { height: 46, padding: '0 12px', fontSize: 15, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', outline: 'none' },
  textarea: { width: '100%', padding: 10, fontSize: 15, border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  descHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  autoFill: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)', background: '#eef6f5', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', cursor: 'pointer' },
  counter: { fontSize: 12, color: '#9a9a92', alignSelf: 'flex-end' },
  radioRow: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' },
  radio: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, minHeight: 36 },
  checkWrap: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, minHeight: 36 },
  toggleLine: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 },
  warn: { fontSize: 13, color: '#9a6b00' },
  err: { color: '#c0392b', fontSize: 13 },
  aiHint: { fontSize: 12, color: '#3A9EA5', margin: '4px 0 0' },
  sugBox: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, padding: 8, background: '#F4F3EE', borderRadius: 10 },
  sugLabel: { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B6860' },
  sugItem: { textAlign: 'left', fontSize: 14, color: '#1A1916', background: '#fff', border: '1px solid #E2E8E8', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' },
  benchBar: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 },
  benchBtn: { fontSize: 13, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#3A9EA5,#2E8A91)', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer' },
  benchHint: { fontSize: 13, color: '#3A6B1A' },
  benchUse: { fontSize: 13, fontWeight: 700, color: '#3A9EA5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  submit: { minHeight: 52, fontSize: 16, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  success: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 'var(--space-4)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', textAlign: 'center' },
  successIcon: { width: 56, height: 56, borderRadius: '9999px', background: '#e6f5ea', color: '#1d7a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 },
  successTitle: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.6rem', margin: 0 },
  successSub: { fontSize: 14, color: '#55554f', margin: 0, maxWidth: 380 },
  successBtns: { display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  primary: { padding: '12px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  secondary: { padding: '12px 20px', fontWeight: 600, color: '#55554f', background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)' },
};
