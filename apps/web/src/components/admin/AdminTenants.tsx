'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

const KNOWN_FEATURES = ['job_posting', 'chat', 'video_interviews', 'referrals', 'endorsements', 'reviews', 'screening'];

export function AdminTenants() {
  const utils = trpc.useUtils();
  const q = trpc.tenant.listTenantsForAdmin.useQuery();
  const create = trpc.tenant.createTenant.useMutation({ onSuccess: () => { setNew({ slug: '', name: '', domain: '', primary: '#F5C842', secondary: '#3A9EA5' }); void utils.tenant.listTenantsForAdmin.invalidate(); } });
  const update = trpc.tenant.updateTenantBranding.useMutation({ onSuccess: () => void utils.tenant.listTenantsForAdmin.invalidate() });
  const toggle = trpc.tenant.toggleTenantFeature.useMutation({ onSuccess: () => void utils.tenant.listTenantsForAdmin.invalidate() });

  const [newT, setNew] = useState({ slug: '', name: '', domain: '', primary: '#F5C842', secondary: '#3A9EA5' });
  const [err, setErr] = useState<string | null>(null);

  const rows = q.data ?? [];

  const onCreate = () => {
    setErr(null);
    if (newT.slug.length < 2 || newT.name.length < 2) { setErr('Slug and name required.'); return; }
    create.mutate({ slug: newT.slug, name: newT.name, domain: newT.domain || undefined, colors: { primary: newT.primary, secondary: newT.secondary } }, { onError: (e) => setErr(e.message) });
  };

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div>
            <h1 style={s.h1}>Tenants</h1>
            <Link href="/admin/dashboard" style={s.back}>← Dashboard</Link>
          </div>
        </header>

        {/* Create */}
        <section style={s.card}>
          <h2 style={s.h2}>New tenant</h2>
          <div style={s.formGrid}>
            <input value={newT.slug} onChange={(e) => setNew({ ...newT, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="slug (e.g. nursing)" style={s.input} />
            <input value={newT.name} onChange={(e) => setNew({ ...newT, name: e.target.value })} placeholder="Display name" style={s.input} />
            <input value={newT.domain} onChange={(e) => setNew({ ...newT, domain: e.target.value })} placeholder="custom domain (optional)" style={s.input} />
            <label style={s.colorField}>Primary<input type="color" value={newT.primary} onChange={(e) => setNew({ ...newT, primary: e.target.value })} style={s.color} /></label>
            <label style={s.colorField}>Secondary<input type="color" value={newT.secondary} onChange={(e) => setNew({ ...newT, secondary: e.target.value })} style={s.color} /></label>
            <button type="button" onClick={onCreate} disabled={create.isPending} style={s.createBtn}>{create.isPending ? 'Creating…' : 'Create'}</button>
          </div>
          {err && <p style={s.err}>{err}</p>}
          <p style={s.hint}>Subdomain <code>&lt;slug&gt;.ddotsjobs.com</code> resolves automatically; set a custom domain to map another host.</p>
        </section>

        {/* List */}
        {q.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : (
          rows.map((t) => {
            const enabled = new Set(t.features.filter((f) => f.isEnabled).map((f) => f.feature));
            return (
              <section key={t.id} style={s.card}>
                <div style={s.tenantHead}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ ...s.swatch, background: t.colors?.primary ?? '#888' }} />
                    <span style={{ ...s.swatch, background: t.colors?.secondary ?? '#888' }} />
                    <div>
                      <div style={s.tenantName}>{t.name} <span style={s.slug}>· {t.slug}</span></div>
                      <div style={s.domain}>{t.domain ?? `${t.slug}.ddotsjobs.com`}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => update.mutate({ tenantId: t.id, isActive: !t.isActive })}
                    style={{ ...s.activeBtn, background: t.isActive ? '#1d7a3a' : 'rgba(255,255,255,0.1)' }}
                  >
                    {t.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div style={s.features}>
                  {KNOWN_FEATURES.map((f) => {
                    const on = enabled.has(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggle.mutate({ tenantId: t.id, feature: f, isEnabled: !on })}
                        style={{ ...s.featBtn, ...(on ? s.featOn : {}) }}
                      >
                        {on ? '✓ ' : ''}{f.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', padding: 'var(--space-3) var(--space-2)' },
  wrap: { maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 },
  back: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  card: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 },
  h2: { color: '#fff', fontSize: 15, fontWeight: 700, margin: 0 },
  formGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: { flex: '1 1 140px', minWidth: 0, background: '#0F1A1B', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14 },
  colorField: { display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  color: { width: 40, height: 34, border: 'none', background: 'none', padding: 0 },
  createBtn: { background: '#3A9EA5', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  err: { color: '#E8623A', fontSize: 13, margin: 0 },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 },
  muted: { color: 'rgba(255,255,255,0.4)', padding: 8 },
  tenantHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)' },
  tenantName: { color: '#fff', fontSize: 15, fontWeight: 700 },
  slug: { color: 'rgba(255,255,255,0.4)', fontWeight: 400 },
  domain: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  activeBtn: { color: '#fff', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  features: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  featBtn: { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' },
  featOn: { background: 'rgba(58,158,165,0.2)', color: '#fff', borderColor: '#3A9EA5' },
};
