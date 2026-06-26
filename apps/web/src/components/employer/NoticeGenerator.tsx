'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';

function Inner() {
  const params = useSearchParams();
  const urlJobId = params.get('jobId') ?? '';

  const myJobs = trpc.jobs.myJobs.useQuery();
  const profile = trpc.employer.getProfile.useQuery();
  const generate = trpc.walkin.generateNotice.useMutation();
  const save = trpc.walkin.saveNotice.useMutation();

  const walkInJobs = (myJobs.data ?? []).filter((j) => j.isWalkIn && j.status === 'active');
  const [jobId, setJobId] = useState('');
  const [language, setLanguage] = useState<'ml' | 'en'>('ml');
  const [contactPhone, setContactPhone] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!jobId && (urlJobId || walkInJobs[0])) setJobId(urlJobId || walkInJobs[0]!.id);
  }, [urlJobId, walkInJobs, jobId]);
  useEffect(() => {
    if (!contactPhone && profile.data?.contactPhone) setContactPhone(profile.data.contactPhone);
  }, [profile.data, contactPhone]);

  async function doGenerate() {
    if (!jobId) return;
    const res = await generate.mutateAsync({ jobId, language, contactPhone: contactPhone.trim() || undefined });
    setNotice(res.noticeText);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(notice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (myJobs.isSuccess && walkInJobs.length === 0) {
    return (
      <div style={s.empty}>
        <p style={{ fontWeight: 600 }}>No walk-in jobs found.</p>
        <Link href="/employer/jobs/new" style={s.cta}>Post a walk-in job →</Link>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {/* Step 1 */}
      <section style={s.card}>
        <h2 style={s.h2}>1. Select job</h2>
        <select value={jobId} onChange={(e) => { setJobId(e.target.value); setNotice(''); }} style={s.input}>
          {walkInJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
      </section>

      {/* Step 2 */}
      {jobId && (
        <section style={s.card}>
          <h2 style={s.h2}>2. Notice settings</h2>
          <div style={s.field}>
            <span style={s.label}>Language</span>
            <div style={s.toggleRow}>
              {(['ml', 'en'] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLanguage(l)} style={{ ...s.toggle, ...(language === l ? s.on : {}) }}>
                  {l === 'ml' ? 'Malayalam' : 'English'}
                </button>
              ))}
            </div>
          </div>
          <div style={s.field}>
            <span style={s.label}>Contact phone <span style={s.muted}>(appears in notice)</span></span>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={s.input} />
          </div>
          {generate.error && <p style={s.err}>{generate.error.message}</p>}
          <button type="button" disabled={generate.isPending} onClick={doGenerate} style={s.primary}>
            {generate.isPending ? 'Generating…' : 'Generate Notice'}
          </button>
        </section>
      )}

      {/* Step 3 */}
      {notice && (
        <section style={s.card}>
          <h2 style={s.h2}>3. Preview</h2>
          <div style={s.preview}>{notice}</div>
          <div style={s.actions}>
            <button type="button" onClick={copy} style={s.action}>{copied ? 'Copied!' : 'Copy to clipboard'}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(notice)}`} target="_blank" rel="noopener noreferrer" style={s.share}>Share on WhatsApp</a>
            <button type="button" onClick={doGenerate} disabled={generate.isPending} style={s.action}>Regenerate</button>
            <button type="button" onClick={() => save.mutate({ jobId, noticeText: notice })} style={s.action}>
              {save.isSuccess ? 'Saved ✓' : 'Save notice'}
            </button>
          </div>
          <div style={s.tips}>
            <strong>WhatsApp sharing tips:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Share in your professional WhatsApp groups</li>
              <li>Best time to share: 8–10am or 5–7pm</li>
              <li>Pin the message in your group</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

export function NoticeGenerator() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' },
  cta: { padding: '10px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  card: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', margin: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 },
  label: { fontSize: 14, fontWeight: 600, color: '#33332f' },
  muted: { fontSize: 12, color: '#9a9a92', fontWeight: 400 },
  input: { height: 46, padding: '0 12px', fontSize: 15, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', outline: 'none' },
  toggleRow: { display: 'flex', gap: 8 },
  toggle: { flex: 1, minHeight: 44, fontSize: 15, fontWeight: 600, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  on: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  err: { color: '#c0392b', fontSize: 13 },
  primary: { minHeight: 48, marginTop: 6, fontSize: 16, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  preview: { whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.6, padding: 'var(--space-2)', background: '#fff', borderTop: '4px solid var(--color-brand)', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', maxHeight: 360, overflowY: 'auto', color: '#0f0e0c' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'var(--space-1)' },
  action: { minHeight: 44, padding: '0 16px', fontSize: 14, fontWeight: 600, color: '#0f0e0c', background: '#f1f1ec', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  share: { minHeight: 44, padding: '0 18px', display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 600, color: '#fff', background: '#25d366', borderRadius: 'var(--radius-pill)' },
  tips: { marginTop: 'var(--space-1)', fontSize: 13, color: '#55554f' },
};
