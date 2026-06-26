'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc/client';
import { DISTRICTS, EMPLOYEE_COUNTS, EMPLOYER_TYPES, GST_REGEX } from '@/lib/constants';

type District = (typeof DISTRICTS)[number]['value'];
type EType = (typeof EMPLOYER_TYPES)[number]['value'];
type Mime = 'image/jpeg' | 'image/png' | 'image/webp';

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(f);
  });
}

export function RegisterForm() {
  const router = useRouter();
  const { update } = useSession();

  const [companyName, setCompanyName] = useState('');
  const [companyNameMl, setCompanyNameMl] = useState('');
  const [employerType, setEmployerType] = useState<EType>('hospital');
  const [district, setDistrict] = useState<District>('thiruvananthapuram');
  const [employeeCount, setEmployeeCount] = useState<(typeof EMPLOYEE_COUNTS)[number] | ''>('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [gst, setGst] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('+91');
  const [description, setDescription] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const register = trpc.employer.register.useMutation();
  const uploadLogo = trpc.employer.uploadLogo.useMutation();

  const gstValid = gst === '' || GST_REGEX.test(gst);
  const phoneValid = /^\+91[6-9]\d{9}$/.test(contactPhone);
  const canSubmit =
    companyName.trim().length >= 2 && contactName.trim().length >= 2 && phoneValid && gstValid && !register.isPending;

  function onLogo(f: File | null) {
    setLogoFile(f);
    setLogoPreview(null);
    if (f && f.size <= 2 * 1024 * 1024) void fileToDataUrl(f).then(setLogoPreview);
  }

  async function submit() {
    const res = await register.mutateAsync({
      companyName: companyName.trim(),
      companyNameMl: companyNameMl.trim() || undefined,
      employerType,
      district,
      gstNumber: gst.trim() || undefined,
      contactName: contactName.trim(),
      contactPhone,
      websiteUrl: websiteUrl.trim() || undefined,
      description: description.trim() || undefined,
      employeeCountRange: employeeCount || undefined,
    });
    if (logoFile && logoPreview) {
      try {
        await uploadLogo.mutateAsync({ logoBase64: logoPreview, mimeType: logoFile.type as Mime });
      } catch {
        // logo optional — ignore failure
      }
    }
    // Refresh JWT role so /employer/* becomes accessible.
    await update({ role: 'employer' });
    void res;
  }

  if (register.isSuccess) {
    return (
      <div style={s.success}>
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>Company registered</h2>
        <p style={s.successSub}>
          Your account is under review. You can post jobs immediately — the verified badge appears after review.
        </p>
        <button type="button" onClick={() => router.push('/employer/dashboard')} style={s.primary}>
          Go to dashboard →
        </button>
      </div>
    );
  }

  const conflict = register.error?.data?.code === 'CONFLICT';

  return (
    <div style={s.form}>
      <Section title="Company details">
        <Field label="Company name (English)" required>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={s.input} />
        </Field>
        <Field label="Company name (Malayalam)" hint="ഉദാ: KIMS ഹെൽത്ത്കെയർ">
          <input value={companyNameMl} onChange={(e) => setCompanyNameMl(e.target.value)} style={s.input} />
        </Field>
        <Field label="Employer type">
          <select value={employerType} onChange={(e) => setEmployerType(e.target.value as EType)} style={s.input}>
            {EMPLOYER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="District">
          <select value={district} onChange={(e) => setDistrict(e.target.value as District)} style={s.input}>
            {DISTRICTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Employee count">
          <select value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value as (typeof EMPLOYEE_COUNTS)[number])} style={s.input}>
            <option value="">Select range</option>
            {EMPLOYEE_COUNTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Website URL">
          <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" style={s.input} />
        </Field>
      </Section>

      <Section title="Verification">
        <Field label="GST number" hint="GST verification helps build trust with job seekers">
          <input value={gst} onChange={(e) => setGst(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" style={s.input} />
          {gst.length > 0 && !gstValid && <span style={s.err}>Invalid GST format</span>}
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Contact person name" required>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={s.input} />
        </Field>
        <Field label="Contact phone (+91)" hint="Not shown to job seekers" required>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value.replace(/\s/g, ''))} style={s.input} />
          {contactPhone.length > 3 && !phoneValid && <span style={s.err}>Enter a valid +91 number</span>}
        </Field>
        <Field label="Description" hint="Tell job seekers about your company">
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={4} style={s.textarea} />
          <span style={s.counter}>{description.length} / 1000</span>
        </Field>
      </Section>

      <Section title="Logo (optional)">
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} style={s.file} />
        {logoFile && logoFile.size > 2 * 1024 * 1024 && <span style={s.err}>Logo exceeds 2MB</span>}
        {logoPreview && <img src={logoPreview} alt="logo preview" style={s.logo} />}
      </Section>

      {conflict ? (
        <div style={s.errCard}>
          You already have an employer account. <Link href="/employer/dashboard" style={s.link}>Go to dashboard →</Link>
        </div>
      ) : (
        register.error && <p style={s.err}>{register.error.message}</p>
      )}

      <button type="button" disabled={!canSubmit} onClick={submit} style={{ ...s.primary, opacity: canSubmit ? 1 : 0.6 }}>
        {register.isPending ? 'Registering…' : 'Register Company'}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={s.section}>
      <h2 style={s.h2}>{title}</h2>
      {children}
    </section>
  );
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
  input: { height: 48, padding: '0 12px', fontSize: 16, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', outline: 'none' },
  textarea: { width: '100%', padding: 10, fontSize: 15, border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  counter: { fontSize: 12, color: '#9a9a92', alignSelf: 'flex-end' },
  file: { fontSize: 14 },
  logo: { maxWidth: 120, maxHeight: 120, borderRadius: 'var(--radius-input)', border: '1px solid #e2e2dc' },
  err: { color: '#c0392b', fontSize: 13 },
  errCard: { padding: 'var(--space-2)', background: '#fdecea', color: '#c0392b', borderRadius: 'var(--radius-card)', fontSize: 14 },
  link: { color: 'var(--color-accent)', fontWeight: 600 },
  primary: { minHeight: 52, fontSize: 16, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  success: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 'var(--space-4)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', textAlign: 'center' },
  successIcon: { width: 56, height: 56, borderRadius: '9999px', background: '#e6f5ea', color: '#1d7a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 },
  successTitle: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.6rem', margin: 0 },
  successSub: { fontSize: 14, color: '#55554f', margin: 0, maxWidth: 380 },
};
