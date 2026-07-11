'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { initials, titleCase } from '@/lib/format';

const SIZES = ['1-10', '11-50', '51-200', '200+'];

export function CompanyDirectory() {
  const q = trpc.company.listCompanies.useQuery({});
  const [search, setSearch] = useState('');
  const [size, setSize] = useState('');
  const rows = q.data ?? [];

  const view = useMemo(() => {
    const t = search.trim().toLowerCase();
    return rows.filter((r) => (size === '' || r.size === size) && (t === '' || (r.name ?? '').toLowerCase().includes(t)));
  }, [rows, search, size]);

  return (
    <div style={s.wrap}>
      <header>
        <p style={s.eyebrow}>Discover</p>
        <h1 style={s.h1}>Companies hiring in Kerala</h1>
        <p style={s.sub}>Browse verified employers and their open roles.</p>
      </header>

      <div style={s.controls}>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search companies…" style={s.searchBox} />
        <select value={size} onChange={(e) => setSize(e.target.value)} style={s.select}>
          <option value="">All sizes</option>
          {SIZES.map((z) => <option key={z} value={z}>{z} employees</option>)}
        </select>
      </div>

      {q.isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : view.length === 0 ? (
        <div style={s.empty}><p style={{ fontWeight: 600 }}>No companies found.</p></div>
      ) : (
        <div style={s.grid}>
          {view.map((r) => (
            <Link key={r.slug} href={`/companies/${r.slug}`} style={s.card}>
              <div style={s.logo}>{r.logoUrl ? <img src={r.logoUrl} alt="" style={s.logoImg} /> : <span style={s.logoText}>{initials(r.name ?? 'Co')}</span>}</div>
              <div style={s.body}>
                <div style={s.name}>{r.name ?? 'Company'}{r.verified === 'verified' && <span style={s.verified}> ✓</span>}</div>
                <div style={s.meta}>
                  {r.type && <span>{titleCase(r.type)}</span>}
                  {r.district && <><span style={s.dot}>·</span><span>{titleCase(r.district)}</span></>}
                  {r.size && <><span style={s.dot}>·</span><span>{r.size}</span></>}
                </div>
                <div style={s.jobs}>{r.openJobs} open job{r.openJobs === 1 ? '' : 's'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', maxWidth: 900, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent)', margin: 0 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,5vw,2.4rem)', margin: '2px 0 0', color: 'var(--color-dark)' },
  sub: { fontSize: 14, color: '#6b6b66', margin: '6px 0 0' },
  controls: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  searchBox: { flex: '1 1 220px', minWidth: 0, border: '1px solid #e2e2da', borderRadius: 10, padding: '11px 14px', fontSize: 14, minHeight: 44 },
  select: { border: '1px solid #e2e2da', borderRadius: 10, padding: '11px 12px', fontSize: 14, minHeight: 44, background: '#fff' },
  muted: { color: '#8a8a83', fontSize: 14 },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 'var(--space-2)' },
  card: { display: 'flex', gap: 12, alignItems: 'center', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  logo: { flex: '0 0 52px', width: 52, height: 52, borderRadius: 12, background: '#eef6f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  logoText: { fontSize: 16, fontWeight: 700, color: 'var(--color-accent)' },
  body: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  name: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  verified: { color: 'var(--color-accent)' },
  meta: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: '#6b6b66' },
  dot: { color: '#c9c7bd' },
  jobs: { fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' },
};
