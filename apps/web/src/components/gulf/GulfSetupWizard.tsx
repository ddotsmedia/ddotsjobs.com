'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { DISTRICTS } from '@/lib/constants';
import { norkaEligibleSlugs } from '@/lib/norka';

const GULF_COUNTRIES = [
  { value: 'uae', label: 'UAE' },
  { value: 'saudi_arabia', label: 'Saudi Arabia' },
  { value: 'qatar', label: 'Qatar' },
  { value: 'kuwait', label: 'Kuwait' },
  { value: 'oman', label: 'Oman' },
  { value: 'bahrain', label: 'Bahrain' },
] as const;

const URGENCY = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'within_60_days', label: 'Within 60 days' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'flexible', label: 'Flexible' },
] as const;

type Country = (typeof GULF_COUNTRIES)[number]['value'];
type Urgency = (typeof URGENCY)[number]['value'];

function splitTags(v: string): string[] {
  return v.split(',').map((x) => x.trim()).filter(Boolean);
}

export function GulfSetupWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [profile, setProfile] = useState({ totalYearsAbroad: 2, financialUrgency: 'moderate' as Urgency });

  return (
    <main style={s.page}>
      <div style={s.container}>
        <h1 style={s.h1}>Gulf Return setup</h1>
        <div style={s.steps}>
          <Step n={1} label="Profile" active={step === 1} done={step > 1} />
          <Step n={2} label="Work history" active={step === 2} done={false} />
        </div>
        {step === 1 ? (
          <ProfileStep
            onDone={(p) => {
              setProfile(p);
              setStep(2);
            }}
          />
        ) : (
          <WorkStep totalYearsAbroad={profile.totalYearsAbroad} financialUrgency={profile.financialUrgency} />
        )}
      </div>
    </main>
  );
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div style={s.step}>
      <span style={{ ...s.stepDot, background: active || done ? 'var(--color-accent)' : '#d8d8d0' }}>{n}</span>
      <span style={{ ...s.stepLabel, color: active ? 'var(--color-dark)' : '#9a9a92' }}>{label}</span>
    </div>
  );
}

function ProfileStep({ onDone }: { onDone: (p: { totalYearsAbroad: number; financialUrgency: Urgency }) => void }) {
  const [totalYearsAbroad, setYears] = useState(2);
  const [primaryCountry, setCountry] = useState<Country>('uae');
  const [returnDate, setReturnDate] = useState('');
  const [financialUrgency, setUrgency] = useState<Urgency>('moderate');
  const [norkaId, setNorkaId] = useState('');
  const [districts, setDistricts] = useState<Set<string>>(new Set());

  const create = trpc.pravasi.createProfile.useMutation({
    onSuccess: () => onDone({ totalYearsAbroad, financialUrgency }),
  });

  function toggleDistrict(v: string) {
    setDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  return (
    <section style={s.card}>
      <Label>Country worked in</Label>
      <select value={primaryCountry} onChange={(e) => setCountry(e.target.value as Country)} style={s.input}>
        {GULF_COUNTRIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      <Label>Total years abroad</Label>
      <input type="number" min={1} max={50} value={totalYearsAbroad} onChange={(e) => setYears(Number(e.target.value))} style={s.input} />

      <Label>Return date (optional)</Label>
      <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} style={s.input} />

      <Label>Financial urgency</Label>
      <div style={s.radioGroup}>
        {URGENCY.map((u) => (
          <label key={u.value} style={s.radio}>
            <input type="radio" name="urgency" checked={financialUrgency === u.value} onChange={() => setUrgency(u.value)} />
            {u.label}
          </label>
        ))}
      </div>

      <Label>NORKA ID (optional)</Label>
      <input type="text" value={norkaId} onChange={(e) => setNorkaId(e.target.value)} placeholder="NORKA registration ID" style={s.input} />

      <Label>Preferred districts</Label>
      <div style={s.checkWrap}>
        {DISTRICTS.map((d) => (
          <label key={d.value} style={s.check}>
            <input type="checkbox" checked={districts.has(d.value)} onChange={() => toggleDistrict(d.value)} />
            {d.label}
          </label>
        ))}
      </div>

      {create.error && <p style={s.err}>{create.error.message}</p>}
      <button
        type="button"
        disabled={create.isPending}
        onClick={() =>
          create.mutate({
            totalYearsAbroad,
            primaryCountry,
            returnDate: returnDate || undefined,
            financialUrgency,
            norkaId: norkaId.trim() || undefined,
            seekingEmploymentIn: [...districts] as (typeof DISTRICTS)[number]['value'][],
          })
        }
        style={s.primaryBtn}
      >
        {create.isPending ? 'Saving…' : 'Continue'}
      </button>
    </section>
  );
}

function WorkStep({ totalYearsAbroad, financialUrgency }: { totalYearsAbroad: number; financialUrgency: Urgency }) {
  const utils = trpc.useUtils();
  const list = trpc.pravasi.getTranslations.useQuery(undefined, {
    refetchInterval: (q) => {
      const data = q.state.data;
      const pending = data?.some((e) => !e.translationSource || e.translatedKeralaTitles.length === 0);
      return pending ? 2500 : false;
    },
  });
  const schemes = trpc.pravasi.norkaSchemes.useQuery();
  const eligible = useMemo(
    () => new Set(norkaEligibleSlugs({ totalYearsAbroad, financialUrgency })),
    [totalYearsAbroad, financialUrgency],
  );

  const [country, setCountry] = useState<Country>('uae');
  const [gulfJobTitle, setTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [yearsInRole, setYears] = useState(1);
  const [skills, setSkills] = useState('');
  const [certs, setCerts] = useState('');

  const add = trpc.pravasi.addWorkHistory.useMutation({
    onSuccess: () => {
      setTitle(''); setIndustry(''); setSkills(''); setCerts('');
      void utils.pravasi.getTranslations.invalidate();
    },
  });
  const confirm = trpc.pravasi.confirmTranslation.useMutation({
    onSuccess: () => void utils.pravasi.getTranslations.invalidate(),
  });

  const entries = list.data ?? [];

  return (
    <div style={s.workGrid}>
      <section style={s.card}>
        <h2 style={s.h2}>Add your Gulf work experience</h2>
        <Label>Gulf job title</Label>
        <input type="text" value={gulfJobTitle} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Site Supervisor" style={s.input} />
        <Label>Country</Label>
        <select value={country} onChange={(e) => setCountry(e.target.value as Country)} style={s.input}>
          {GULF_COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <Label>Industry</Label>
        <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Construction" style={s.input} />
        <Label>Years in this role</Label>
        <input type="number" min={1} max={40} value={yearsInRole} onChange={(e) => setYears(Number(e.target.value))} style={s.input} />
        <Label>Key skills (comma separated)</Label>
        <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="welding, safety, AutoCAD" style={s.input} />
        <Label>Certifications (comma separated)</Label>
        <input type="text" value={certs} onChange={(e) => setCerts(e.target.value)} placeholder="NEBOSH, IOSH" style={s.input} />
        {add.error && <p style={s.err}>{add.error.message}</p>}
        <button
          type="button"
          disabled={add.isPending || gulfJobTitle.trim().length < 2}
          onClick={() =>
            add.mutate({
              country,
              gulfJobTitle: gulfJobTitle.trim(),
              industry: industry.trim() || undefined,
              yearsInRole,
              keySkills: splitTags(skills),
              certifications: splitTags(certs),
            })
          }
          style={s.primaryBtn}
        >
          {add.isPending ? 'Adding…' : 'Add experience'}
        </button>

        {entries.length > 0 && (
          <Link href="/jobs?gulf=1" style={s.matchBtn}>View matching jobs →</Link>
        )}
      </section>

      <section style={s.col}>
        {entries.length > 0 && (
          <div style={s.card}>
            <h2 style={s.h2}>Your experience</h2>
            {entries.map((e) => {
              const primary = e.translatedKeralaTitles[0];
              const translating = !e.translationSource || e.translatedKeralaTitles.length === 0;
              return (
                <div key={e.id} style={s.entry}>
                  <div style={s.entryTitle}>{e.gulfJobTitle}</div>
                  <div style={s.entryMeta}>{e.yearsInRole} yrs · {e.industry ?? '—'}</div>
                  {translating ? (
                    <span style={s.translating}>Translating to Kerala equivalent…</span>
                  ) : (
                    <>
                      <span style={s.equiv}>Kerala equivalent: <strong>{primary}</strong></span>
                      {e.translationSource !== 'user_confirmed' && (
                        <button
                          type="button"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate({ workHistoryId: e.id, confirmedTitles: e.translatedKeralaTitles })}
                          style={s.confirmBtn}
                        >
                          Confirm
                        </button>
                      )}
                      {e.translationSource === 'user_confirmed' && <span style={s.confirmed}>✓ Confirmed</span>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={s.card}>
          <h2 style={s.h2}>NORKA schemes for you</h2>
          {(schemes.data ?? []).filter((sc) => eligible.has(sc.slug)).map((sc) => (
            <div key={sc.slug} style={s.scheme}>
              <div style={s.schemeName}>{sc.name}</div>
              {sc.descriptionMl && <p style={s.schemeDesc}>{sc.descriptionMl}</p>}
              {sc.documents.length > 0 && <p style={s.schemeDocs}>Documents: {sc.documents.join(', ')}</p>}
              {sc.applyUrl && (
                <a href={sc.applyUrl} target="_blank" rel="noopener noreferrer nofollow" style={s.schemeApply}>Apply ↗</a>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={s.label}>{children}</span>;
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 920, margin: '0 auto', padding: '0 var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.6rem)', margin: 'var(--space-3) 0 var(--space-2)' },
  steps: { display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' },
  step: { display: 'flex', alignItems: 'center', gap: 8 },
  stepDot: { width: 28, height: 28, borderRadius: '9999px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 },
  stepLabel: { fontSize: 14, fontWeight: 600 },
  workGrid: { display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', flexWrap: 'wrap' },
  col: { flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  card: { flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 8, padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', margin: '0 0 4px' },
  label: { fontSize: 13, fontWeight: 600, color: '#55554f', marginTop: 6 },
  input: { height: 46, padding: '0 12px', fontSize: 15, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', outline: 'none' },
  radioGroup: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' },
  radio: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, minHeight: 36 },
  checkWrap: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 4 },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, minHeight: 32 },
  err: { color: '#c0392b', fontSize: 13 },
  primaryBtn: { minHeight: 48, marginTop: 'var(--space-1)', fontSize: 16, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  matchBtn: { textAlign: 'center', marginTop: 'var(--space-1)', padding: '10px', fontWeight: 600, color: 'var(--color-accent)' },
  entry: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', borderTop: '1px solid #f1f1ec' },
  entryTitle: { fontSize: 15, fontWeight: 600 },
  entryMeta: { fontSize: 13, color: '#6b6b66' },
  translating: { fontSize: 13, color: '#9a6b00' },
  equiv: { fontSize: 14, color: '#33332f' },
  confirmBtn: { alignSelf: 'flex-start', minHeight: 36, padding: '0 14px', fontSize: 13, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  confirmed: { fontSize: 13, fontWeight: 600, color: '#1d7a3a' },
  scheme: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-1) 0', borderTop: '1px solid #f1f1ec' },
  schemeName: { fontSize: 15, fontWeight: 600 },
  schemeDesc: { fontSize: 13, color: '#33332f', margin: 0 },
  schemeDocs: { fontSize: 12, color: '#9a9a92', margin: 0 },
  schemeApply: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
};
