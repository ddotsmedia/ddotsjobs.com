'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

const FLAGS: { key: string; label: string; help: string }[] = [
  { key: 'job_moderation_required', label: 'Job moderation required', help: 'All jobs need admin approval before going live.' },
  { key: 'auto_approve_verified', label: 'Auto-approve verified employers', help: 'Skip moderation for verified employers.' },
  { key: 'ai_features_enabled', label: 'AI features enabled', help: 'JD generator, resume builder, etc.' },
  { key: 'new_registrations_open', label: 'New registrations open', help: 'Allow new seeker/employer sign-ups.' },
  { key: 'whatsapp_alerts_active', label: 'WhatsApp alerts active', help: 'Send job alerts to WhatsApp groups.' },
  { key: 'payment_enabled', label: 'Payments enabled (Razorpay)', help: 'Allow paid subscriptions.' },
  { key: 'maintenance_mode', label: 'Maintenance mode', help: 'Shows a maintenance page to visitors.' },
];
const FIELDS: { key: string; label: string }[] = [
  { key: 'default_job_expiry_days', label: 'Default job expiry (days)' },
  { key: 'max_free_jobs', label: 'Max jobs · free employer' },
  { key: 'risk_score_threshold', label: 'Risk score threshold for review (0-100)' },
  { key: 'site_tagline', label: 'Site tagline' },
  { key: 'contact_whatsapp', label: 'Contact WhatsApp' },
  { key: 'contact_email', label: 'Contact email' },
];

export function SiteSettings() {
  const settings = trpc.admin.getSiteSettings.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.admin.updateSiteSetting.useMutation({
    onSuccess: () => { void utils.admin.getSiteSettings.invalidate(); setSaved((s) => s + 1); },
  });
  const [saved, setSaved] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const map = new Map((settings.data ?? []).map((r) => [r.key, r.value ?? '']));
  const val = (k: string) => drafts[k] ?? map.get(k) ?? '';

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div>
            <h1 style={s.h1}>Site settings</h1>
            <p style={s.sub}>Feature flags + platform config{saved > 0 ? ' · saved ✓' : ''}</p>
          </div>
          <Link href="/admin/dashboard" style={s.back}>← Dashboard</Link>
        </header>

        {settings.isLoading ? (
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</p>
        ) : (
          <>
            <h2 style={s.h2}>Feature flags</h2>
            <div style={s.card}>
              {FLAGS.map((f) => {
                const on = val(f.key) === 'true';
                return (
                  <div key={f.key} style={s.flagRow}>
                    <div>
                      <div style={s.flagLabel}>{f.label}</div>
                      <div style={s.flagHelp}>{f.help}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => update.mutate({ key: f.key, value: on ? 'false' : 'true' })}
                      disabled={update.isPending}
                      style={{ ...s.toggle, background: on ? '#3A9EA5' : 'rgba(255,255,255,0.15)' }}
                      aria-pressed={on}
                    >
                      <span style={{ ...s.knob, transform: on ? 'translateX(22px)' : 'translateX(0)' }} />
                    </button>
                  </div>
                );
              })}
            </div>

            <h2 style={s.h2}>Platform config</h2>
            <div style={s.card}>
              {FIELDS.map((f) => (
                <div key={f.key} style={s.fieldRow}>
                  <label style={s.fieldLabel}>{f.label}</label>
                  <div style={s.fieldInputWrap}>
                    <input
                      value={val(f.key)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                      style={s.input}
                    />
                    <button
                      type="button"
                      onClick={() => update.mutate({ key: f.key, value: val(f.key) })}
                      disabled={update.isPending}
                      style={s.saveBtn}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', padding: 'var(--space-3) var(--space-2)' },
  wrap: { maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '4px 0 0' },
  back: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  h2: { color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', margin: '8px 0 0' },
  card: { background: '#1A2B2D', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', padding: 8 },
  flagRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  flagLabel: { color: '#fff', fontSize: 15, fontWeight: 600 },
  flagHelp: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  toggle: { position: 'relative', width: 48, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2 },
  knob: { display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'transform 0.15s' },
  fieldRow: { padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  fieldLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, display: 'block', marginBottom: 6 },
  fieldInputWrap: { display: 'flex', gap: 8 },
  input: { flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14, outline: 'none' },
  saveBtn: { background: '#F5C842', color: '#0F1A1B', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
};
