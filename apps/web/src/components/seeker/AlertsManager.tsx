'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { DISTRICTS, SECTORS } from '@/lib/constants';

type Lang = 'ml' | 'en';
type Freq = 'immediate' | 'daily_digest';

function previewMessage(p: {
  language: Lang;
  jobTitle: string;
  company: string;
  district: string;
  salaryRupees: number;
  isWalkIn: boolean;
}): string {
  const salary = `₹${p.salaryRupees.toLocaleString('en-IN')}/mo\n`;
  const walk = p.isWalkIn ? '📅 Walk-in available\n' : '';
  if (p.language === 'ml') {
    return `🔔 നിങ്ങൾക്കായി ഒരു job\n\n${p.jobTitle}\n${p.company} · ${p.district}\n${salary}${walk}\n👉 ddotsjobs.com/jobs/...\n\nSTOP അയക്കുക alerts നിർത്താൻ`;
  }
  return `🔔 New job for you\n\n${p.jobTitle}\n${p.company} · ${p.district}\n${salary}${walk}\n👉 ddotsjobs.com/jobs/...\n\nReply STOP to unsubscribe`;
}

export function AlertsManager() {
  const utils = trpc.useUtils();
  const mySubs = trpc.alerts.mySubscriptions.useQuery();

  const [language, setLanguage] = useState<Lang>('ml');
  const [frequency, setFrequency] = useState<Freq>('immediate');
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [districts, setDistricts] = useState<Set<string>>(new Set());
  const [salaryMin, setSalaryMin] = useState(15000);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [valuesGulf, setValuesGulf] = useState(false);
  const [done, setDone] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const subscribe = trpc.alerts.subscribe.useMutation({
    onSuccess: () => {
      setDone(true);
      void utils.alerts.mySubscriptions.invalidate();
    },
  });
  const unsubscribe = trpc.alerts.unsubscribe.useMutation({
    onSuccess: () => void utils.alerts.mySubscriptions.invalidate(),
  });

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setter(next);
  };

  const preview = useMemo(
    () =>
      previewMessage({
        language,
        jobTitle: 'Staff Nurse',
        company: 'Aster Medcity',
        district: districts.size > 0 ? titleCase([...districts][0]!) : 'Ernakulam',
        salaryRupees: salaryMin,
        isWalkIn,
      }),
    [language, districts, salaryMin, isWalkIn],
  );

  const valid = categories.size >= 1 && districts.size >= 1;
  const active = (mySubs.data ?? []).find((s) => s.channel === 'whatsapp' && s.isActive);

  const matchPreview = trpc.alerts.getAlertMatchingJobs.useQuery(
    { subscriptionId: active?.id ?? '' },
    { enabled: showPreview && Boolean(active?.id) },
  );

  function submit() {
    setDone(false);
    subscribe.mutate({
      channel: 'whatsapp',
      language,
      frequency,
      categories: [...categories],
      districts: [...districts] as ('thiruvananthapuram')[],
      salaryMinPaise: salaryMin * 100,
      isWalkIn: isWalkIn || undefined,
      valuesGulfExperience: valuesGulf || undefined,
    });
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <h1 style={s.h1}>Job Alerts</h1>
        <p style={s.sub}>Get matched jobs on WhatsApp in Malayalam or English.</p>

        {active && (
          <div style={s.activeCard}>
            <div>
              <strong>Alerts enabled ✓</strong>
              <span style={s.activeSub}>
                {active.filters.filter((f) => f.filterType === 'category').length} categories ·{' '}
                {active.filters.filter((f) => f.filterType === 'district').length} districts · sent {active.totalSent}
              </span>
            </div>
            <button type="button" onClick={() => unsubscribe.mutate({ channel: 'whatsapp' })} style={s.stopBtn}>
              Pause alerts
            </button>
          </div>
        )}

        {active && (
          <section style={s.card}>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              {showPreview ? 'Hide preview' : 'Preview matching jobs →'}
            </button>
            {showPreview && (
              <div style={{ marginTop: 12 }}>
                {matchPreview.isLoading && <p style={{ color: '#6b6b66', fontSize: 14 }}>Loading…</p>}
                {matchPreview.data && (
                  <>
                    <p style={{ color: '#6b6b66', fontSize: 14, margin: '0 0 8px' }}>
                      {matchPreview.data.count} live job{matchPreview.data.count === 1 ? '' : 's'} match your alert right now
                    </p>
                    <ul style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {matchPreview.data.jobs.slice(0, 5).map((j) => (
                        <li key={j.id} style={{ fontSize: 14 }}>
                          <a href={`/jobs/${j.slug ?? j.id}`} style={{ color: 'var(--color-accent)' }}>{j.title}</a>
                          {' — '}{j.company}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {done && !subscribe.isPending && (
          <div style={s.success}>
            <strong>Alerts enabled ✓</strong>
            <span>You&rsquo;ll receive jobs matching your preferences on WhatsApp.</span>
          </div>
        )}

        <section style={s.card}>
          <Field label="Language">
            <div style={s.toggleRow}>
              {(['ml', 'en'] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLanguage(l)} style={{ ...s.toggleBtn, ...(language === l ? s.on : {}) }}>
                  {l === 'ml' ? 'Malayalam' : 'English'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Frequency">
            <div style={s.toggleRow}>
              {([['immediate', 'Immediate'], ['daily_digest', 'Daily digest']] as const).map(([v, lbl]) => (
                <button key={v} type="button" onClick={() => setFrequency(v)} style={{ ...s.toggleBtn, ...(frequency === v ? s.on : {}) }}>
                  {lbl}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Job categories (min 1)">
            <div style={s.tiles}>
              {SECTORS.map((c) => {
                const on = categories.has(c.slug);
                return (
                  <button key={c.slug} type="button" onClick={() => toggle(categories, setCategories, c.slug)} style={{ ...s.tile, ...(on ? s.tileOn : {}) }}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Districts">
            <div style={s.helperRow}>
              <button type="button" style={s.helper} onClick={() => setDistricts(new Set(DISTRICTS.map((d) => d.value)))}>Select all</button>
              <button type="button" style={s.helper} onClick={() => setDistricts(new Set())}>Clear all</button>
            </div>
            <div style={s.checkWrap}>
              {DISTRICTS.map((d) => (
                <label key={d.value} style={s.check}>
                  <input type="checkbox" checked={districts.has(d.value)} onChange={() => toggle(districts, setDistricts, d.value)} /> {d.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label={`Minimum salary — ₹${salaryMin.toLocaleString('en-IN')}/mo`}>
            <input type="range" min={10000} max={100000} step={5000} value={salaryMin} onChange={(e) => setSalaryMin(Number(e.target.value))} style={s.slider} />
          </Field>

          <Field label="Only show">
            <label style={s.check}><input type="checkbox" checked={isWalkIn} onChange={(e) => setIsWalkIn(e.target.checked)} /> Walk-in available</label>
            <label style={s.check}><input type="checkbox" checked={valuesGulf} onChange={(e) => setValuesGulf(e.target.checked)} /> Gulf Return friendly</label>
          </Field>
        </section>

        {/* WhatsApp preview */}
        <section style={s.previewWrap}>
          <span style={s.previewLabel}>WhatsApp preview</span>
          <div style={s.bubble}>{preview}</div>
        </section>

        {subscribe.error && <p style={s.err}>{subscribe.error.message}</p>}
        <button type="button" disabled={!valid || subscribe.isPending} onClick={submit} style={{ ...s.primary, opacity: valid ? 1 : 0.5 }}>
          {subscribe.isPending ? 'Enabling…' : active ? 'Update Alerts' : 'Enable WhatsApp Alerts'}
        </button>
      </div>
    </main>
  );
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={s.field}>
      <span style={s.label}>{label}</span>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 560, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.4rem)', margin: 0 },
  sub: { fontSize: 14, color: '#55554f', margin: 0 },
  activeCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 'var(--space-2)', background: '#e6f5ea', borderRadius: 'var(--radius-card)' },
  activeSub: { display: 'block', fontSize: 13, color: '#1d7a3a' },
  stopBtn: { minHeight: 40, padding: '0 14px', fontSize: 13, fontWeight: 600, color: '#c0392b', background: '#fff', border: '1px solid #f0d3cf', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  success: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', background: '#e6f5ea', color: '#1d7a3a', borderRadius: 'var(--radius-card)', fontSize: 14 },
  card: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 600, color: '#33332f' },
  toggleRow: { display: 'flex', gap: 8 },
  toggleBtn: { flex: 1, minHeight: 44, fontSize: 14, fontWeight: 600, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  on: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 },
  tile: { minHeight: 48, fontSize: 14, fontWeight: 500, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', cursor: 'pointer' },
  tileOn: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  helperRow: { display: 'flex', gap: 'var(--space-2)' },
  helper: { fontSize: 13, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  checkWrap: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 4 },
  check: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, minHeight: 36 },
  slider: { width: '100%', height: 28, accentColor: '#F5C842' },
  previewWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  previewLabel: { fontSize: 13, fontWeight: 600, color: '#6b6b66' },
  bubble: { whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5, padding: 'var(--space-2)', background: '#dcf8c6', borderRadius: 14, color: '#0f0e0c' },
  err: { color: '#c0392b', fontSize: 13 },
  primary: { minHeight: 50, fontSize: 16, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
};
