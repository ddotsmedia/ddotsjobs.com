'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { DISTRICTS, EMPLOYEE_COUNTS, EMPLOYER_TYPES, GST_REGEX } from '@/lib/constants';
import { initials, titleCase } from '@/lib/format';

type Mime = 'image/jpeg' | 'image/png' | 'image/webp';

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(f);
  });
}

export function EmployerProfile() {
  const utils = trpc.useUtils();
  const profile = trpc.employer.getProfile.useQuery();
  const updateProfile = trpc.employer.updateProfile.useMutation({
    onSuccess: () => {
      setEditing(false);
      void utils.employer.getProfile.invalidate();
    },
  });
  const uploadLogo = trpc.employer.uploadLogo.useMutation({
    onSuccess: () => void utils.employer.getProfile.invalidate(),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  if (profile.isLoading) return <main style={s.page}><div style={s.container}><p>Loading…</p></div></main>;
  const p = profile.data;
  if (!p) {
    return (
      <main style={s.page}>
        <div style={s.container}>
          <p style={{ fontWeight: 600 }}>No employer account.</p>
          <a href="/employer/register" style={s.cta}>Register your company</a>
        </div>
      </main>
    );
  }

  const emp = p;
  const verified = emp.verificationStatus === 'verified';
  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function startEdit() {
    setForm({
      companyNameMl: emp.companyNameMl ?? '',
      employerType: emp.employerType ?? 'other',
      district: emp.district ?? 'thiruvananthapuram',
      gstNumber: emp.gstNumber ?? '',
      contactName: emp.contactName ?? '',
      contactPhone: emp.contactPhone ?? '+91',
      websiteUrl: emp.websiteUrl ?? '',
      description: emp.description ?? '',
      employeeCountRange: emp.employeeCountRange ?? '',
    });
    setEditing(true);
  }
  function save() {
    const gst = form.gstNumber?.trim();
    if (gst && !GST_REGEX.test(gst)) return;
    updateProfile.mutate({
      companyNameMl: form.companyNameMl?.trim() || undefined,
      employerType: (form.employerType as (typeof EMPLOYER_TYPES)[number]['value']) || undefined,
      district: (form.district as (typeof DISTRICTS)[number]['value']) || undefined,
      gstNumber: gst || undefined,
      contactName: form.contactName?.trim() || undefined,
      contactPhone: form.contactPhone || undefined,
      websiteUrl: form.websiteUrl?.trim() || undefined,
      description: form.description?.trim() || undefined,
      employeeCountRange: (form.employeeCountRange as (typeof EMPLOYEE_COUNTS)[number]) || undefined,
    });
  }
  async function onLogo(f: File | null) {
    if (!f || f.size > 2 * 1024 * 1024) return;
    const dataUrl = await fileToDataUrl(f);
    uploadLogo.mutate({ logoBase64: dataUrl, mimeType: f.type as Mime });
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.head}>
          <label style={s.logoWrap}>
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logoUrl} alt="logo" style={s.logoImg} />
            ) : (
              <span style={s.logoInitials}>{initials(p.companyName ?? 'Co')}</span>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
            <span style={s.logoEdit}>Change</span>
          </label>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={s.title}>{p.companyName}</h1>
            <span style={{ ...s.badge, ...(verified ? s.badgeOk : s.badgePending) }}>
              {verified ? '✓ Verified employer' : 'Pending verification'}
            </span>
            {!verified && <p style={s.pendingNote}>Our team reviews new accounts within 24h.</p>}
            <p style={s.tier}>Plan: {titleCase(p.subscriptionTier)} · {p.jobsPostedThisPeriod}/{p.jobsLimitThisPeriod} job posts used</p>
          </div>
        </div>

        <section style={s.card}>
          <div style={s.cardHead}>
            <h2 style={s.h2}>Company details</h2>
            {!editing && <button type="button" onClick={startEdit} style={s.edit}>Edit</button>}
          </div>

          {!editing ? (
            <div style={s.rows}>
              <Row label="Malayalam name" value={p.companyNameMl ?? '—'} />
              <Row label="Type" value={titleCase(p.employerType ?? '—')} />
              <Row label="District" value={p.district ? titleCase(p.district) : '—'} />
              <Row label="Employees" value={p.employeeCountRange ?? '—'} />
              <Row label="GST" value={p.gstNumber ?? '—'} />
              <Row label="Website" value={p.websiteUrl ?? '—'} />
              <Row label="Contact" value={`${p.contactName ?? '—'}${p.contactPhone ? ` · ${p.contactPhone}` : ''}`} />
              <Row label="Description" value={p.description ?? '—'} />
            </div>
          ) : (
            <div style={s.editForm}>
              <Inp label="Malayalam name" value={form.companyNameMl ?? ''} onChange={(v) => set('companyNameMl', v)} />
              <Sel label="Type" value={form.employerType ?? ''} onChange={(v) => set('employerType', v)} options={EMPLOYER_TYPES.map((t) => [t.value, t.label])} />
              <Sel label="District" value={form.district ?? ''} onChange={(v) => set('district', v)} options={DISTRICTS.map((d) => [d.value, d.label])} />
              <Sel label="Employees" value={form.employeeCountRange ?? ''} onChange={(v) => set('employeeCountRange', v)} options={EMPLOYEE_COUNTS.map((c) => [c, c])} />
              <Inp label="GST" value={form.gstNumber ?? ''} onChange={(v) => set('gstNumber', v.toUpperCase())} />
              <Inp label="Website" value={form.websiteUrl ?? ''} onChange={(v) => set('websiteUrl', v)} />
              <Inp label="Contact name" value={form.contactName ?? ''} onChange={(v) => set('contactName', v)} />
              <Inp label="Contact phone" value={form.contactPhone ?? ''} onChange={(v) => set('contactPhone', v)} />
              <div style={s.field}>
                <span style={s.label}>Description</span>
                <textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value.slice(0, 1000))} rows={3} style={s.textarea} />
              </div>
              {updateProfile.error && <span style={s.err}>{updateProfile.error.message}</span>}
              <div style={s.btnRow}>
                <button type="button" onClick={() => setEditing(false)} style={s.secondary}>Cancel</button>
                <button type="button" disabled={updateProfile.isPending} onClick={save} style={s.primary}>
                  {updateProfile.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={s.row}><span style={s.rowLabel}>{label}</span><span style={s.rowValue}>{value}</span></div>;
}
function Inp({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div style={s.field}><span style={s.label}>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} style={s.input} /></div>;
}
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[] }) {
  return (
    <div style={s.field}>
      <span style={s.label}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={s.input}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 640, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' },
  logoWrap: { position: 'relative', cursor: 'pointer', textAlign: 'center' },
  logoImg: { width: 72, height: 72, borderRadius: 14, objectFit: 'cover', border: '1px solid #e2e2dc' },
  logoInitials: { width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: 14 },
  logoEdit: { display: 'block', fontSize: 12, color: 'var(--color-accent)', marginTop: 4 },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.5rem,5vw,2rem)', margin: 0 },
  badge: { display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: '9999px', marginTop: 4 },
  badgeOk: { background: '#e6f5ea', color: '#1d7a3a' },
  badgePending: { background: '#fdf0d5', color: '#9a6b00' },
  pendingNote: { fontSize: 12, color: '#9a9a92', margin: '4px 0 0' },
  tier: { fontSize: 13, color: '#55554f', margin: '4px 0 0' },
  card: { padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.3rem', margin: 0 },
  edit: { fontSize: 14, fontWeight: 600, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' },
  rows: { display: 'flex', flexDirection: 'column', gap: 2 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: '1px solid #f4f4ef' },
  rowLabel: { fontSize: 13, color: '#6b6b66' },
  rowValue: { fontSize: 14, color: 'var(--color-dark)', textAlign: 'right', fontWeight: 500, maxWidth: '60%' },
  editForm: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 13, fontWeight: 600, color: '#33332f' },
  input: { height: 44, padding: '0 12px', fontSize: 15, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', outline: 'none' },
  textarea: { width: '100%', padding: 10, fontSize: 15, border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  err: { color: '#c0392b', fontSize: 13 },
  btnRow: { display: 'flex', gap: 8, marginTop: 'var(--space-1)' },
  primary: { flex: 1, minHeight: 46, fontSize: 15, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  secondary: { minHeight: 46, padding: '0 18px', fontSize: 15, fontWeight: 600, color: '#55554f', background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  cta: { padding: '10px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)', display: 'inline-block', marginTop: 8 },
};
