'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';

function StarSelector({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={s.starRow}>
      <span style={s.starLabel}>{label}</span>
      <span style={s.stars} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i} star${i > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(value === i ? 0 : i)}
            style={{ ...s.starBtn, color: i <= (hover || value) ? '#f5a800' : '#d8d8d0' }}
          >
            ★
          </button>
        ))}
      </span>
    </div>
  );
}

export function ReviewForm({ employerId, slug, companyName }: { employerId: string; slug: string; companyName: string }) {
  const router = useRouter();
  const [overall, setOverall] = useState(0);
  const [culture, setCulture] = useState(0);
  const [wlb, setWlb] = useState(0);
  const [pay, setPay] = useState(0);
  const [women, setWomen] = useState(0);
  const [textEn, setTextEn] = useState('');
  const [textMl, setTextMl] = useState('');
  const [anonymous, setAnonymous] = useState(true);

  const submit = trpc.reviews.submit.useMutation({
    onSuccess: () => router.push(`/companies/${slug}?reviewed=1`),
  });

  const textErr = textEn.length > 0 && textEn.length < 50;
  const canSubmit = overall >= 1 && !textErr && !submit.isPending;

  function onSubmit() {
    submit.mutate({
      employerId,
      ratingOverall: overall,
      ...(culture ? { ratingWorkCulture: culture } : {}),
      ...(wlb ? { ratingWorkLifeBalance: wlb } : {}),
      ...(pay ? { ratingPay: pay } : {}),
      ...(women ? { ratingWomenFriendly: women } : {}),
      ...(textEn.trim() ? { reviewText: textEn.trim() } : {}),
      ...(textMl.trim() ? { reviewTextMl: textMl.trim() } : {}),
      isAnonymous: anonymous,
    });
  }

  return (
    <div style={s.wrap}>
      <h1 style={s.h1}>Review {companyName}</h1>

      <section style={s.card}>
        <StarSelector value={overall} onChange={setOverall} label="Overall rating *" />
      </section>

      <section style={s.card}>
        <p style={s.sectionLabel}>Detailed ratings (optional)</p>
        <StarSelector value={culture} onChange={setCulture} label="Work culture" />
        <StarSelector value={wlb} onChange={setWlb} label="Work-life balance" />
        <StarSelector value={pay} onChange={setPay} label="Pay & benefits" />
        <div style={s.womenBlock}>
          <p style={s.womenQ}>Is this workplace safe and respectful for women?</p>
          <StarSelector value={women} onChange={setWomen} label="Women-friendly" />
        </div>
      </section>

      <section style={s.card}>
        <label style={s.fieldLabel}>Your review (English)</label>
        <textarea value={textEn} onChange={(e) => setTextEn(e.target.value.slice(0, 2000))} rows={4} placeholder="Share your honest experience (min 50 characters)…" style={s.textarea} />
        <div style={s.counterRow}>
          {textErr && <span style={s.err}>At least 50 characters</span>}
          <span style={s.counter}>{textEn.length}/2000</span>
        </div>

        <label style={s.fieldLabel}>നിങ്ങളുടെ അഭിപ്രായം (മലയാളം — optional)</label>
        <textarea value={textMl} onChange={(e) => setTextMl(e.target.value.slice(0, 2000))} rows={3} placeholder="മലയാളത്തിൽ എഴുതാം…" style={s.textarea} />
        <div style={s.counterRow}><span style={s.counter}>{textMl.length}/2000</span></div>
      </section>

      <label style={s.anonRow}>
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} style={s.checkbox} />
        <span>
          <span style={s.anonTitle}>Post anonymously</span>
          <span style={s.anonSub}>Your name will not be shown.</span>
        </span>
      </label>

      {submit.error && <p style={s.submitErr}>{submit.error.message}</p>}

      <button type="button" onClick={onSubmit} disabled={!canSubmit} style={{ ...s.submitBtn, opacity: canSubmit ? 1 : 0.55 }}>
        {submit.isPending ? 'Submitting…' : 'Submit Review'}
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', maxWidth: 600, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.6rem,5vw,2.2rem)', margin: 0 },
  card: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  sectionLabel: { fontSize: 13, fontWeight: 600, color: '#6b6b66', margin: 0 },
  starRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' },
  starLabel: { fontSize: 14, color: 'var(--color-dark)' },
  stars: { display: 'inline-flex', gap: 2 },
  starBtn: { fontSize: 30, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, minWidth: 36, minHeight: 36 },
  womenBlock: { marginTop: 6, paddingTop: 8, borderTop: '1px solid #f1f1ec' },
  womenQ: { fontSize: 13, color: '#55554f', margin: '0 0 4px' },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: 'var(--color-dark)', marginTop: 6 },
  textarea: { width: '100%', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' },
  counterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontSize: 12, color: '#9a9a92', marginLeft: 'auto' },
  err: { fontSize: 12, color: '#c0392b' },
  anonRow: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', cursor: 'pointer' },
  checkbox: { width: 20, height: 20, marginTop: 2, flex: '0 0 auto' },
  anonTitle: { display: 'block', fontSize: 14, fontWeight: 600 },
  anonSub: { display: 'block', fontSize: 12, color: '#6b6b66' },
  submitErr: { fontSize: 14, color: '#c0392b', margin: 0 },
  submitBtn: { minHeight: 50, fontSize: 16, fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
};
