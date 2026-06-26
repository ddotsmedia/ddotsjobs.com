'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

const TYPES = [
  { code: 'KNMC', label: 'KNMC', hint: 'Kerala Nurses & Midwives Council registration. Format: KN/YYYY/NNNNN', placeholder: 'KN/2019/12345' },
  { code: 'KTET', label: 'KTET', hint: 'Kerala Teacher Eligibility Test certificate', placeholder: 'KTET/2023/XXXXXX' },
  { code: 'KMC', label: 'KMC', hint: 'Kerala Medical Council registration', placeholder: 'KMC/2020/XXXXX' },
  { code: 'Pharmacy_Council', label: 'Pharmacy', hint: 'Kerala Pharmacy Council registration', placeholder: 'KSPC/XXXXX' },
] as const;

type TypeCode = (typeof TYPES)[number]['code'];
type Mime = 'application/pdf' | 'image/jpeg' | 'image/png';

const MAX = 5 * 1024 * 1024;

const STATUS_UI: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Verification in progress', color: '#9a6b00', bg: '#fdf0d5' },
  verified: { label: '✓ Verified', color: '#1d7a3a', bg: '#e6f5ea' },
  failed: { label: 'Verification failed', color: '#c0392b', bg: '#fdecea' },
  manual_review: { label: 'Under manual review', color: '#9a6b00', bg: '#fdf0d5' },
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

export function VerifyCredentials() {
  const utils = trpc.useUtils();
  const [type, setType] = useState<TypeCode>('KNMC');
  const [regNo, setRegNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);

  const cfg = TYPES.find((t) => t.code === type)!;
  const status = trpc.verification.status.useQuery({ type });
  const badges = trpc.verification.myBadges.useQuery();

  const submit = trpc.verification.submit.useMutation({
    onSuccess: () => {
      setFile(null);
      setPreview(null);
      setRegNo('');
      void utils.verification.status.invalidate();
      void utils.verification.myBadges.invalidate();
    },
  });

  function onFile(f: File | null) {
    setFileErr(null);
    setFile(f);
    setPreview(null);
    if (!f) return;
    if (f.size > MAX) {
      setFileErr('File exceeds 5MB');
      setFile(null);
      return;
    }
    if (f.type.startsWith('image/')) {
      void readAsDataUrl(f).then(setPreview);
    }
  }

  async function onSubmit() {
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    submit.mutate({
      type,
      registrationNumber: regNo.trim(),
      documentBase64: dataUrl,
      documentMimeType: file.type as Mime,
    });
  }

  const cur = status.data;
  const ui = cur ? STATUS_UI[cur.statusCode] : null;

  return (
    <main style={s.page}>
      <div style={s.container}>
        <h1 style={s.h1}>Verify your credentials</h1>
        <p style={s.sub}>Add verified badges to your profile. Employers trust verified candidates more.</p>

        <div style={s.tabs}>
          {TYPES.map((t) => (
            <button key={t.code} type="button" onClick={() => setType(t.code)}
              style={{ ...s.tab, ...(type === t.code ? s.tabOn : {}) }}>{t.label}</button>
          ))}
        </div>

        {/* Current status */}
        {ui && cur && (
          <div style={{ ...s.statusCard, background: ui.bg, color: ui.color }}>
            <strong>{ui.label}</strong>
            {cur.statusCode === 'pending' && <span style={s.statusSub}>Usually takes a few minutes</span>}
            {cur.statusCode === 'verified' && (
              <span style={s.statusSub}>{cur.registrationNumber}{cur.verifiedAt ? ` · ${new Date(cur.verifiedAt).toLocaleDateString('en-IN')}` : ''}</span>
            )}
            {cur.statusCode === 'failed' && <span style={s.statusSub}>{cur.verifierNotes ?? 'Please try again.'}</span>}
            {cur.statusCode === 'manual_review' && <span style={s.statusSub}>Our team will review within 24 hours</span>}
          </div>
        )}

        {/* Form (hidden once verified) */}
        {cur?.statusCode !== 'verified' && (
          <section style={s.card}>
            <p style={s.hint}>{cfg.hint}</p>
            <label style={s.label}>Registration number</label>
            <input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder={cfg.placeholder} style={s.input} />

            <label style={s.label}>Document (.pdf, .jpg, .png — max 5MB)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)} style={s.file} />
            {fileErr && <span style={s.err}>{fileErr}</span>}
            {file && !preview && <span style={s.fileName}>📄 {file.name}</span>}
            {preview && <img src={preview} alt="preview" style={s.thumb} />}

            {submit.error && <span style={s.err}>{submit.error.message}</span>}
            <button type="button" disabled={!file || regNo.trim().length < 3 || submit.isPending}
              onClick={onSubmit} style={{ ...s.primary, opacity: !file || regNo.trim().length < 3 ? 0.5 : 1 }}>
              {submit.isPending ? 'Submitting…' : cur?.statusCode === 'failed' ? 'Try again' : 'Submit for Verification'}
            </button>
          </section>
        )}

        {/* Existing badges */}
        {(badges.data?.length ?? 0) > 0 && (
          <section style={s.card}>
            <h2 style={s.h2}>Your credentials</h2>
            {badges.data!.map((b) => {
              const bui = STATUS_UI[b.statusCode] ?? STATUS_UI.pending!;
              return (
                <div key={b.typeCode} style={s.badgeRow}>
                  <span style={s.badgeType}>{b.typeCode} · {b.registrationNumber}</span>
                  <span style={{ ...s.badgePill, background: bui.bg, color: bui.color }}>{bui.label}</span>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 560, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.4rem)', margin: 0 },
  sub: { fontSize: 14, color: '#55554f', margin: 0 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: { minHeight: 40, padding: '0 16px', fontSize: 14, fontWeight: 600, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  tabOn: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  statusCard: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', borderRadius: 'var(--radius-card)' },
  statusSub: { fontSize: 13, fontWeight: 400 },
  card: { display: 'flex', flexDirection: 'column', gap: 8, padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  hint: { fontSize: 13, color: '#6b6b66', margin: 0 },
  label: { fontSize: 13, fontWeight: 600, color: '#33332f', marginTop: 4 },
  input: { height: 48, padding: '0 12px', fontSize: 16, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', outline: 'none' },
  file: { fontSize: 14 },
  fileName: { fontSize: 14, color: '#55554f' },
  thumb: { maxWidth: 160, maxHeight: 160, borderRadius: 'var(--radius-input)', border: '1px solid #e2e2dc' },
  err: { color: '#c0392b', fontSize: 13 },
  primary: { minHeight: 48, marginTop: 4, fontSize: 16, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', margin: 0 },
  badgeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #f4f4ef' },
  badgeType: { fontSize: 14, color: 'var(--color-dark)' },
  badgePill: { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' },
};
