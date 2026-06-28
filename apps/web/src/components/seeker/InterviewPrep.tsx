'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { SECTORS } from '@/lib/constants';

function Accordion({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div style={s.acc}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={s.accHead}>
        <span>{title}</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul style={s.accList}>
          {items.map((q, i) => <li key={i} style={s.accItem}>{q}</li>)}
        </ul>
      )}
    </div>
  );
}

export function InterviewPrep({ initialTitle = '', initialCategory = '' }: { initialTitle?: string; initialCategory?: string }) {
  const [jobTitle, setJobTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [language, setLanguage] = useState<'ml' | 'en'>('ml');
  const gen = trpc.interview.generateQuestions.useMutation();
  const data = gen.data;

  return (
    <div style={s.wrap}>
      <header>
        <h1 style={s.h1}>Interview Prep · ഇന്റർവ്യൂ തയ്യാറെടുപ്പ്</h1>
        <p style={s.sub}>AI-generated questions, tips and checklist for your role.</p>
      </header>

      <div style={s.form}>
        <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title (e.g. Staff Nurse)" style={s.input} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={s.input} aria-label="Category">
          <option value="">Category</option>
          {SECTORS.map((sec) => <option key={sec.slug} value={sec.slug}>{sec.label}</option>)}
        </select>
        <div style={s.langRow}>
          {(['ml', 'en'] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLanguage(l)} style={{ ...s.langBtn, ...(language === l ? s.langOn : {}) }}>
              {l === 'ml' ? 'മലയാളം' : 'English'}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={jobTitle.trim().length < 2 || gen.isPending}
          onClick={() => gen.mutate({ jobTitle: jobTitle.trim(), category, employerType: '', language })}
          style={{ ...s.genBtn, opacity: jobTitle.trim().length < 2 || gen.isPending ? 0.55 : 1 }}
        >
          {gen.isPending ? 'Generating…' : 'Generate prep guide'}
        </button>
      </div>

      {gen.error && <p style={s.err}>{gen.error.message}</p>}

      {data && (
        <div style={s.results}>
          <Accordion title="Common questions" items={data.common_questions} />
          <Accordion title="Technical questions" items={data.technical_questions} />
          <Accordion title="മലയാളം ചോദ്യങ്ങൾ" items={data.malayalam_questions} />
          <Accordion title="Tips" items={[...data.tips, ...data.tips_ml]} />
          <div style={s.card}>
            <p style={s.cardHead}>What to bring</p>
            <ul style={s.accList}>
              {data.documents_to_bring.map((d, i) => <li key={i} style={s.accItem}>☐ {d}</li>)}
            </ul>
            <p style={s.dress}>👔 {data.dress_code}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', maxWidth: 720, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.6rem,5vw,2.2rem)', margin: 0, color: '#1A1916' },
  sub: { fontSize: 14, color: '#6B6860', margin: '4px 0 0' },
  form: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  input: { minHeight: 46, padding: '0 14px', fontSize: 15, background: '#faf9f5', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)' },
  langRow: { display: 'flex', gap: 8 },
  langBtn: { flex: 1, minHeight: 40, fontSize: 14, fontWeight: 600, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  langOn: { background: 'rgba(58,158,165,0.12)', color: '#3A9EA5', borderColor: 'rgba(58,158,165,0.35)' },
  genBtn: { minHeight: 48, fontSize: 16, fontWeight: 700, color: '#1A1916', background: '#F5C842', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  err: { fontSize: 14, color: '#c0392b', margin: 0 },
  results: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  acc: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', overflow: 'hidden' },
  accHead: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: 'var(--space-2)', fontSize: 15, fontWeight: 700, background: '#fff', border: 'none', cursor: 'pointer', color: '#1A1916' },
  accList: { listStyle: 'none', margin: 0, padding: '0 var(--space-2) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 8 },
  accItem: { fontSize: 14, color: '#33332f', lineHeight: 1.5 },
  card: { padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  cardHead: { fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: '#1A1916' },
  dress: { fontSize: 14, color: '#55554f', marginTop: 8 },
};
