'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

type Exp = { company: string; role: string; startDate?: string; endDate?: string; description?: string };
type Edu = { institution: string; degree: string; year?: string };
type Cert = { name: string; issuer?: string; year?: string };
type Template = 'kerala-classic' | 'modern-minimal' | 'gulf-ready';

interface ResumeState {
  id?: string;
  title: string;
  summary: string;
  experience: Exp[];
  education: Edu[];
  skills: string[];
  languages: string[];
  certifications: Cert[];
  templateId: Template;
}
const EMPTY: ResumeState = { title: '', summary: '', experience: [], education: [], skills: [], languages: [], certifications: [], templateId: 'kerala-classic' };
const STEPS = ['Personal', 'Experience', 'Education', 'Skills', 'Preview'] as const;
const TEMPLATES: { id: Template; label: string }[] = [
  { id: 'kerala-classic', label: 'Kerala Classic' },
  { id: 'modern-minimal', label: 'Modern Minimal' },
  { id: 'gulf-ready', label: 'Gulf-Ready' },
];

export function ResumeBuilderPro({ seekerName }: { seekerName: string }) {
  const [r, setR] = useState<ResumeState>(EMPTY);
  const [step, setStep] = useState(0);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [savedAt, setSavedAt] = useState<string>('');
  const dirty = useRef(false);
  const rRef = useRef(r);
  rRef.current = r;

  const utils = trpc.useUtils();
  const existing = trpc.resume.getByUser.useQuery();
  const create = trpc.resume.create.useMutation();
  const update = trpc.resume.update.useMutation();
  const enhance = trpc.resume.generateSummary.useMutation();

  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !existing.data) return;
    loaded.current = true;
    const row = existing.data[0];
    if (row) {
      setR({
        id: row.id,
        title: row.title ?? '',
        summary: row.summary ?? '',
        experience: (row.experience as Exp[]) ?? [],
        education: (row.education as Edu[]) ?? [],
        skills: row.skills ?? [],
        languages: row.languages ?? [],
        certifications: (row.certifications as Cert[]) ?? [],
        templateId: (row.templateId as Template) ?? 'kerala-classic',
      });
    }
  }, [existing.data]);

  const save = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    const cur = rRef.current;
    const payload = {
      title: cur.title, summary: cur.summary, experience: cur.experience, education: cur.education,
      skills: cur.skills, languages: cur.languages, certifications: cur.certifications, templateId: cur.templateId,
    };
    if (cur.id) {
      await update.mutateAsync({ id: cur.id, ...payload });
    } else {
      const res = await create.mutateAsync(payload);
      setR((s2) => ({ ...s2, id: res.id }));
    }
    setSavedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    void utils.resume.getByUser.invalidate();
  }, [create, update, utils]);

  useEffect(() => {
    const id = setInterval(() => void save(), 30_000);
    return () => clearInterval(id);
  }, [save]);

  function patch(pt: Partial<ResumeState>) { dirty.current = true; setR((st) => ({ ...st, ...pt })); }
  function addArr<K extends 'experience' | 'education' | 'certifications'>(key: K, item: ResumeState[K][number]) {
    dirty.current = true; setR((st) => ({ ...st, [key]: [...st[key], item] }));
  }
  function updateArr<K extends 'experience' | 'education' | 'certifications'>(key: K, i: number, patchObj: Partial<ResumeState[K][number]>) {
    dirty.current = true; setR((st) => ({ ...st, [key]: st[key].map((it, idx) => (idx === i ? { ...it, ...patchObj } : it)) }));
  }
  function removeArr(key: 'experience' | 'education' | 'certifications', i: number) {
    dirty.current = true; setR((st) => ({ ...st, [key]: st[key].filter((_, idx) => idx !== i) }));
  }
  async function aiEnhance(mode: 'summary' | 'experience', draft: string, apply: (t: string) => void) {
    if (draft.trim().length < 10) return;
    const res = await enhance.mutateAsync({ mode, draft, title: r.title || undefined });
    if (res?.text) { apply(res.text); dirty.current = true; }
  }

  return (
    <main style={s.main}>
      <div style={s.head}>
        <div>
          <h1 style={s.h1}>Resume Builder</h1>
          <Link href="/seeker/dashboard" style={s.back}>← Dashboard</Link>
        </div>
        <div style={s.headRight}>
          <span style={s.saved}>{savedAt ? `Saved ${savedAt}` : 'Auto-saves every 30s'}</span>
          <button type="button" onClick={() => void save()} style={s.saveBtn}>Save</button>
          <button type="button" onClick={() => window.print()} style={s.pdfBtn}>⬇ PDF</button>
        </div>
      </div>

      <div className="ddj-mobile-only" style={s.tabToggle}>
        <button type="button" onClick={() => setMobileTab('form')} style={{ ...s.tabBtn, ...(mobileTab === 'form' ? s.tabActive : {}) }}>Edit</button>
        <button type="button" onClick={() => setMobileTab('preview')} style={{ ...s.tabBtn, ...(mobileTab === 'preview' ? s.tabActive : {}) }}>Preview</button>
      </div>

      <div style={s.split}>
        <div style={{ ...s.formCol, ...(mobileTab === 'preview' ? s.hideMobile : {}) }} data-resume-noprint>
          <div style={s.steps}>
            {STEPS.map((label, i) => (
              <button key={label} type="button" onClick={() => setStep(i)} style={{ ...s.stepPill, ...(step === i ? s.stepActive : {}) }}>{i + 1}. {label}</button>
            ))}
          </div>

          {step === 0 && (
            <Section>
              <Field label="Headline / title"><input value={r.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Staff Nurse — ICU (KNMC)" style={s.input} /></Field>
              <Field label="Professional summary">
                <textarea value={r.summary} onChange={(e) => patch({ summary: e.target.value })} rows={4} placeholder="2-3 sentence summary. Malayalam supported." style={s.textarea} />
                <button type="button" onClick={() => void aiEnhance('summary', r.summary, (t) => patch({ summary: t }))} disabled={enhance.isPending} style={s.aiBtn}>{enhance.isPending ? '…' : '✨ Enhance with AI'}</button>
              </Field>
              <Field label="Template">
                <div style={s.tplRow}>
                  {TEMPLATES.map((t) => (
                    <button key={t.id} type="button" onClick={() => patch({ templateId: t.id })} style={{ ...s.tplBtn, ...(r.templateId === t.id ? s.tplActive : {}) }}>{t.label}</button>
                  ))}
                </div>
              </Field>
            </Section>
          )}

          {step === 1 && (
            <Section>
              {r.experience.map((x, i) => (
                <div key={i} style={s.itemCard}>
                  <input value={x.role} onChange={(e) => updateArr('experience', i, { role: e.target.value })} placeholder="Role" style={s.input} />
                  <input value={x.company} onChange={(e) => updateArr('experience', i, { company: e.target.value })} placeholder="Company" style={s.input} />
                  <div style={s.row2}>
                    <input value={x.startDate ?? ''} onChange={(e) => updateArr('experience', i, { startDate: e.target.value })} placeholder="From (e.g. 2021)" style={s.input} />
                    <input value={x.endDate ?? ''} onChange={(e) => updateArr('experience', i, { endDate: e.target.value })} placeholder="To (or Present)" style={s.input} />
                  </div>
                  <textarea value={x.description ?? ''} onChange={(e) => updateArr('experience', i, { description: e.target.value })} rows={3} placeholder="What you did" style={s.textarea} />
                  <div style={s.itemActions}>
                    <button type="button" onClick={() => void aiEnhance('experience', x.description ?? '', (t) => updateArr('experience', i, { description: t }))} disabled={enhance.isPending} style={s.aiBtn}>✨ Enhance</button>
                    <button type="button" onClick={() => removeArr('experience', i)} style={s.removeBtn}>Remove</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addArr('experience', { company: '', role: '' })} style={s.addBtn}>+ Add experience</button>
            </Section>
          )}

          {step === 2 && (
            <Section>
              {r.education.map((x, i) => (
                <div key={i} style={s.itemCard}>
                  <input value={x.degree} onChange={(e) => updateArr('education', i, { degree: e.target.value })} placeholder="Degree / course" style={s.input} />
                  <input value={x.institution} onChange={(e) => updateArr('education', i, { institution: e.target.value })} placeholder="Institution" style={s.input} />
                  <input value={x.year ?? ''} onChange={(e) => updateArr('education', i, { year: e.target.value })} placeholder="Year" style={s.input} />
                  <button type="button" onClick={() => removeArr('education', i)} style={s.removeBtn}>Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => addArr('education', { institution: '', degree: '' })} style={s.addBtn}>+ Add education</button>
              <Field label="Certifications">
                {r.certifications.map((c, i) => (
                  <div key={i} style={s.row2}>
                    <input value={c.name} onChange={(e) => updateArr('certifications', i, { name: e.target.value })} placeholder="Certification" style={s.input} />
                    <button type="button" onClick={() => removeArr('certifications', i)} style={s.removeBtn}>×</button>
                  </div>
                ))}
                <button type="button" onClick={() => addArr('certifications', { name: '' })} style={s.addBtn}>+ Add certification</button>
              </Field>
            </Section>
          )}

          {step === 3 && (
            <Section>
              <TagField label="Skills" values={r.skills} onChange={(v) => patch({ skills: v })} placeholder="Add a skill + Enter" />
              <TagField label="Languages" values={r.languages} onChange={(v) => patch({ languages: v })} placeholder="e.g. Malayalam, English + Enter" />
            </Section>
          )}

          {step === 4 && <p style={s.hint}>Preview on the right. Use ⬇ PDF (browser print → Save as PDF).</p>}

          <div style={s.navRow}>
            <button type="button" disabled={step === 0} onClick={() => setStep((x) => x - 1)} style={s.navBtn}>← Back</button>
            <button type="button" disabled={step === STEPS.length - 1} onClick={() => setStep((x) => x + 1)} style={s.navBtnPrimary}>Next →</button>
          </div>
        </div>

        <div style={{ ...s.previewCol, ...(mobileTab === 'form' ? s.hideMobile : {}) }}>
          <div data-resume-print>
            <ResumePreview r={r} name={seekerName} />
          </div>
        </div>
      </div>
    </main>
  );
}

function ResumePreview({ r, name }: { r: ResumeState; name: string }) {
  const accent = r.templateId === 'gulf-ready' ? '#0F1A1B' : r.templateId === 'modern-minimal' ? '#1A1916' : '#3A9EA5';
  const headerBg = r.templateId === 'modern-minimal' ? '#fff' : accent;
  const headerFg = r.templateId === 'modern-minimal' ? '#1A1916' : '#fff';
  return (
    <div style={p.sheet}>
      <div style={{ ...p.header, background: headerBg, color: headerFg, borderBottom: r.templateId === 'modern-minimal' ? `3px solid ${accent}` : 'none' }}>
        <h2 style={p.name}>{name || 'Your Name'}</h2>
        {r.title && <p style={{ ...p.title, color: headerFg, opacity: 0.85 }}>{r.title}</p>}
      </div>
      <div style={p.body}>
        {r.summary && <Block accent={accent} title="Summary"><p style={p.text}>{r.summary}</p></Block>}
        {r.experience.length > 0 && (
          <Block accent={accent} title="Experience">
            {r.experience.map((x, i) => (
              <div key={i} style={p.entry}>
                <div style={p.entryTop}><strong>{x.role || 'Role'}</strong><span style={p.muted}>{[x.startDate, x.endDate].filter(Boolean).join(' – ')}</span></div>
                <div style={p.muted}>{x.company}</div>
                {x.description && <p style={p.text}>{x.description}</p>}
              </div>
            ))}
          </Block>
        )}
        {r.education.length > 0 && (
          <Block accent={accent} title="Education">
            {r.education.map((x, i) => (
              <div key={i} style={p.entry}><div style={p.entryTop}><strong>{x.degree}</strong><span style={p.muted}>{x.year}</span></div><div style={p.muted}>{x.institution}</div></div>
            ))}
          </Block>
        )}
        {r.skills.length > 0 && <Block accent={accent} title="Skills"><div style={p.chips}>{r.skills.map((sk) => <span key={sk} style={{ ...p.chip, borderColor: accent }}>{sk}</span>)}</div></Block>}
        {r.languages.length > 0 && <Block accent={accent} title="Languages"><p style={p.text}>{r.languages.join(' · ')}</p></Block>}
        {r.certifications.length > 0 && <Block accent={accent} title="Certifications"><ul style={p.ul}>{r.certifications.map((c, i) => <li key={i}>{c.name}{c.issuer ? ` — ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}</li>)}</ul></Block>}
      </div>
    </div>
  );
}

function Block({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return <div style={p.block}><h3 style={{ ...p.blockTitle, color: accent, borderBottom: `1px solid ${accent}33` }}>{title}</h3>{children}</div>;
}
function Section({ children }: { children: React.ReactNode }) { return <div style={s.section}>{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={s.field}><span style={s.label}>{label}</span>{children}</label>;
}
function TagField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  return (
    <Field label={label}>
      <div style={s.chipInputRow}>
        {values.map((v) => (
          <span key={v} style={s.tag}>{v}<button type="button" onClick={() => onChange(values.filter((x) => x !== v))} style={s.tagX}>×</button></span>
        ))}
      </div>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); if (!values.includes(draft.trim())) onChange([...values, draft.trim()]); setDraft(''); } }} placeholder={placeholder} style={s.input} />
    </Field>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#F4F3EE', padding: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', maxWidth: 1100, margin: '0 auto', flexWrap: 'wrap', gap: 10 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, margin: 0, color: '#1A1916' },
  back: { color: '#6b6860', fontSize: 13 },
  headRight: { display: 'flex', gap: 8, alignItems: 'center' },
  saved: { fontSize: 12, color: '#9a9a92' },
  saveBtn: { background: '#fff', border: '1px solid #d8d8d0', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' },
  pdfBtn: { background: '#3A9EA5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabToggle: { display: 'flex', gap: 6, maxWidth: 1100, margin: '12px auto 0' },
  tabBtn: { flex: 1, background: '#fff', border: '1px solid #d8d8d0', borderRadius: 8, padding: 10, fontSize: 14, cursor: 'pointer' },
  tabActive: { background: '#3A9EA5', color: '#fff', borderColor: '#3A9EA5' },
  split: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'var(--space-2)', maxWidth: 1100, margin: '16px auto 0' },
  formCol: { display: 'flex', flexDirection: 'column', gap: 12 },
  previewCol: { background: '#e9e8e2', borderRadius: 12, padding: 16, overflowX: 'auto' },
  hideMobile: {},
  steps: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  stepPill: { background: '#fff', border: '1px solid #d8d8d0', borderRadius: 999, padding: '6px 12px', fontSize: 13, cursor: 'pointer' },
  stepActive: { background: '#1A1916', color: '#fff', borderColor: '#1A1916' },
  section: { background: '#fff', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#3a3a34' },
  input: { border: '1px solid #d8d8d0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%' },
  textarea: { border: '1px solid #d8d8d0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%', resize: 'vertical' },
  aiBtn: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#3A9EA5', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  tplRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tplBtn: { background: '#fff', border: '1px solid #d8d8d0', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer' },
  tplActive: { background: 'rgba(58,158,165,0.15)', borderColor: '#3A9EA5', color: '#2E8A91', fontWeight: 600 },
  itemCard: { border: '1px solid #efefe9', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  row2: { display: 'flex', gap: 8 },
  itemActions: { display: 'flex', justifyContent: 'space-between' },
  removeBtn: { background: 'none', border: 'none', color: '#c0392b', fontSize: 13, cursor: 'pointer' },
  addBtn: { background: 'rgba(58,158,165,0.1)', border: '1px dashed #3A9EA5', color: '#2E8A91', borderRadius: 8, padding: 10, fontSize: 13, cursor: 'pointer' },
  chipInputRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: { background: '#F4F3EE', borderRadius: 999, padding: '4px 10px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 },
  tagX: { background: 'none', border: 'none', cursor: 'pointer', color: '#9a6b00', fontSize: 14 },
  hint: { color: '#6b6860', fontSize: 14 },
  navRow: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  navBtn: { background: '#fff', border: '1px solid #d8d8d0', borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' },
  navBtnPrimary: { background: '#F5C842', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700, color: '#0F1A1B', cursor: 'pointer' },
};
const p: Record<string, React.CSSProperties> = {
  sheet: { background: '#fff', borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.1)', minHeight: 600, overflow: 'hidden', maxWidth: 640, margin: '0 auto' },
  header: { padding: '24px 28px' },
  name: { margin: 0, fontSize: 26, fontWeight: 700 },
  title: { margin: '4px 0 0', fontSize: 15 },
  body: { padding: '20px 28px' },
  block: { marginBottom: 18 },
  blockTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 4, margin: '0 0 8px' },
  entry: { marginBottom: 10 },
  entryTop: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  muted: { color: '#6b6860', fontSize: 13 },
  text: { fontSize: 13, lineHeight: 1.6, color: '#2a2a26', margin: '4px 0 0' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { border: '1px solid', borderRadius: 999, padding: '3px 10px', fontSize: 12, color: '#2a2a26' },
  ul: { margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: '#2a2a26', lineHeight: 1.6 },
};
