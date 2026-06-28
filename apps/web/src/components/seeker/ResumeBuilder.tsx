'use client';

import { trpc } from '@/lib/trpc/client';

export function ResumeBuilder() {
  const gen = trpc.resume.generate.useMutation();
  const r = gen.data;

  function download() {
    if (!r) return;
    const lines = [
      'PROFESSIONAL SUMMARY', r.summary, '', r.summary_ml, '',
      'SKILLS', ...r.skills.map((x) => `- ${x}`), '',
      'STRENGTHS', ...r.strengths.map((x) => `- ${x}`), '',
      'EXPERIENCE', r.experience_placeholder, '',
      'EDUCATION', r.education_placeholder, '',
      'CERTIFICATIONS', ...r.certifications.map((x) => `- ${x}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ddotsjobs-resume.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={s.wrap}>
      <header>
        <h1 style={s.h1}>AI Resume Builder</h1>
        <p style={s.sub}>Generate a professional CV skeleton from your profile. Edit before you use it.</p>
      </header>

      <button
        type="button"
        onClick={() => gen.mutate()}
        disabled={gen.isPending}
        style={{ ...s.genBtn, opacity: gen.isPending ? 0.55 : 1 }}
      >
        {gen.isPending ? 'Generating…' : r ? 'Regenerate' : 'Generate my resume'}
      </button>
      {gen.error && <p style={s.err}>{gen.error.message}</p>}

      {r && (
        <div style={s.preview}>
          <p style={s.aiNote}>AI generated — please review and edit before using.</p>
          <Section title="Professional summary"><p style={s.p}>{r.summary}</p><p style={s.pMl}>{r.summary_ml}</p></Section>
          <Section title="Skills"><Chips items={r.skills} /></Section>
          <Section title="Strengths"><Chips items={r.strengths} /></Section>
          <Section title="Experience"><p style={s.placeholder}>{r.experience_placeholder}</p></Section>
          <Section title="Education"><p style={s.placeholder}>{r.education_placeholder}</p></Section>
          {r.certifications.length > 0 && <Section title="Certifications"><Chips items={r.certifications} /></Section>}
          <button type="button" onClick={download} style={s.dlBtn}>Download as text</button>
          <p style={s.pdfNote}>PDF export coming soon.</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <p style={s.sectionTitle}>{title}</p>
      {children}
    </div>
  );
}
function Chips({ items }: { items: string[] }) {
  return (
    <div style={s.chips}>
      {items.map((x, i) => <span key={i} style={s.chip}>{x}</span>)}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', maxWidth: 720, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.6rem,5vw,2.2rem)', margin: 0, color: '#1A1916' },
  sub: { fontSize: 14, color: '#6B6860', margin: '4px 0 0' },
  genBtn: { minHeight: 48, fontSize: 16, fontWeight: 700, color: '#1A1916', background: '#F5C842', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  err: { fontSize: 14, color: '#c0392b', margin: 0 },
  preview: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  aiNote: { fontSize: 12, color: '#A36C00', background: 'rgba(245,200,66,0.15)', padding: '6px 10px', borderRadius: 8, margin: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#3A9EA5', margin: 0 },
  p: { fontSize: 14, color: '#33332f', lineHeight: 1.55, margin: 0 },
  pMl: { fontSize: 14, color: '#55554f', lineHeight: 1.6, margin: '4px 0 0' },
  placeholder: { fontSize: 14, color: '#9a9a92', fontStyle: 'italic', margin: 0 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 13, color: '#1A1916', background: '#f1f1ec', padding: '4px 12px', borderRadius: 'var(--radius-pill)' },
  dlBtn: { alignSelf: 'flex-start', minHeight: 44, padding: '0 24px', fontSize: 14, fontWeight: 700, color: '#fff', background: '#3A9EA5', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  pdfNote: { fontSize: 12, color: '#B0AD9F', margin: 0 },
};
