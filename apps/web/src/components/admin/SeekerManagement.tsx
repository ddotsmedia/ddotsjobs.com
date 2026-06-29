'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { relativeTime } from '@/lib/format';
import { DISTRICTS, JOB_CATEGORIES } from '@/lib/constants';

type StatusFilter = 'all' | 'verified' | 'active' | 'new' | 'banned';

// Privacy: "Rajan Menon" -> "Rajan M.", single name -> as-is.
function shortName(name: string | null): string {
  if (!name) return 'Seeker';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? 'Seeker';
  if (parts.length <= 1) return first;
  const last = parts[parts.length - 1] ?? '';
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}
function initial(name: string | null): string {
  return (name?.trim()[0] ?? 'S').toUpperCase();
}
function expLabel(months: number | null): string {
  if (!months || months <= 0) return 'Fresher';
  const y = Math.floor(months / 12);
  return y > 0 ? `${y}y` : `${months}m`;
}
const AVATAR_BG = ['#3A9EA5', '#E8623A', '#8DC63F', '#F5C842', '#5A8A8A', '#9B7BD4'];
function avatarColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h + c.charCodeAt(0)) % AVATAR_BG.length;
  return AVATAR_BG[h] ?? '#3A9EA5';
}
const BAN_REASONS = ['Fake profile', 'Spam applications', 'Abusive behavior', 'Duplicate account', 'Fraudulent documents'];

export function SeekerManagement() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState('');
  const [district, setDistrict] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<{ id: string; name: string } | null>(null);

  const stats = trpc.admin.seekerStats.useQuery();
  const list = trpc.admin.getSeekers.useQuery({
    search: search || undefined, status,
    category: category || undefined, district: district || undefined,
    limit: 50, offset: 0,
  });

  function refresh() {
    void utils.admin.getSeekers.invalidate();
    void utils.admin.seekerStats.invalidate();
  }
  const verify = trpc.admin.verifyProfessional.useMutation({ onSuccess: refresh });
  const unverify = trpc.admin.unverifyProfessional.useMutation({ onSuccess: refresh });
  const unban = trpc.admin.unbanSeeker.useMutation({ onSuccess: refresh });

  function exportCsv() {
    const rows = list.data ?? [];
    const head = ['Name', 'Profession', 'District', 'Experience', 'Profile%', 'Applications', 'Verified', 'Status', 'Joined'];
    const body = rows.map((r) => [shortName(r.name), r.profession ?? '', r.district ?? '', expLabel(r.experienceMonths), r.completionPct ?? 0, r.applicationsCount, r.isVerified ? 'yes' : 'no', r.isBanned ? 'banned' : 'active', new Date(r.createdAt).toISOString().slice(0, 10)]);
    const csv = [head, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'seekers.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const statCards = [
    { label: 'Total seekers', value: stats.data?.total ?? 0, color: '#3A9EA5' },
    { label: 'Verified', value: stats.data?.verified ?? 0, color: '#2ec27a' },
    { label: 'New this week', value: stats.data?.newThisWeek ?? 0, color: '#F5C842' },
    { label: 'Active this week', value: stats.data?.activeWeek ?? 0, color: '#3A9EA5' },
    { label: 'Banned', value: stats.data?.banned ?? 0, color: (stats.data?.banned ?? 0) > 0 ? '#E8623A' : '#3A9EA5' },
  ];

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div>
            <h1 style={s.h1}>Seeker Management</h1>
            <Link href="/admin/dashboard" style={s.back}>← Dashboard</Link>
          </div>
          <button type="button" onClick={exportCsv} style={s.exportBtn}>Export CSV</button>
        </header>

        <section style={s.statsRow}>
          {statCards.map((c) => (
            <div key={c.label} style={s.statCard}>
              <div style={{ ...s.statValue, color: c.color }}>{c.value}</div>
              <div style={s.statLabel}>{c.label}</div>
            </div>
          ))}
        </section>

        <div style={s.controls}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or profession…" style={s.search} />
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} style={s.select}>
            <option value="all">All</option><option value="verified">Verified</option><option value="active">Active</option><option value="new">New</option><option value="banned">Banned</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={s.select}>
            <option value="">All categories</option>
            {JOB_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} style={s.select}>
            <option value="">All districts</option>
            {DISTRICTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <div style={s.tableCard}>
          {list.isLoading ? (
            <p style={s.muted}>Loading…</p>
          ) : list.isError ? (
            <p style={{ color: '#E8623A' }}>Failed to load seekers.</p>
          ) : (list.data ?? []).length === 0 ? (
            <p style={s.muted}>No seekers match.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr style={s.theadRow}>
                  <th style={s.th}>Seeker</th><th style={s.th}>District</th><th style={s.th}>Exp</th>
                  <th style={s.thNum}>Profile</th><th style={s.thNum}>Apps</th><th style={s.th}>Verified</th>
                  <th style={s.th}>Status</th><th style={s.th}>Joined</th><th style={s.thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data!.map((r) => (
                  <tr key={r.id} style={s.row}>
                    <td style={s.td}>
                      <div style={s.seekerCell}>
                        <span style={{ ...s.avatar, background: avatarColor(r.id) }}>{initial(r.name)}</span>
                        <div>
                          <button type="button" onClick={() => setDetailId(r.id)} style={s.nameLink}>{shortName(r.name)}</button>
                          <div style={s.sub}>{r.profession ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={s.td}>{r.district ?? '—'}</td>
                    <td style={s.td}>{expLabel(r.experienceMonths)}</td>
                    <td style={s.tdNum}>{r.completionPct ?? 0}%</td>
                    <td style={s.tdNum}>{r.applicationsCount}</td>
                    <td style={s.td}>{r.isVerified ? <span style={{ color: '#2ec27a' }}>✅</span> : <span style={s.muted}>—</span>}</td>
                    <td style={s.td}>{r.isBanned ? <span style={{ color: '#E8623A' }}>🚫 Banned</span> : <span style={{ color: '#2ec27a' }}>Active</span>}</td>
                    <td style={s.td}>{relativeTime(r.createdAt)}</td>
                    <td style={s.tdRight}>
                      <div style={s.actions}>
                        <button type="button" onClick={() => setDetailId(r.id)} style={s.btnGhost}>Details</button>
                        {!r.isVerified
                          ? <button type="button" onClick={() => verify.mutate({ seekerId: r.id })} disabled={verify.isPending} style={s.btnVerify}>Verify</button>
                          : <button type="button" onClick={() => { const x = prompt('Reason to unverify?'); if (x) unverify.mutate({ seekerId: r.id, reason: x }); }} style={s.btnGhost}>Unverify</button>}
                        {r.isBanned
                          ? <button type="button" onClick={() => unban.mutate({ seekerId: r.id })} style={s.btnVerify}>Unban</button>
                          : <button type="button" onClick={() => setBanTarget({ id: r.id, name: shortName(r.name) })} style={s.btnBan}>Ban</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detailId && <DetailPanel seekerId={detailId} onClose={() => setDetailId(null)} onBan={(id, name) => { setDetailId(null); setBanTarget({ id, name }); }} onChanged={refresh} />}
      {banTarget && <BanModal target={banTarget} onClose={() => setBanTarget(null)} onDone={() => { setBanTarget(null); refresh(); }} />}
    </main>
  );
}

function DetailPanel({ seekerId, onClose, onBan, onChanged }: { seekerId: string; onClose: () => void; onBan: (id: string, name: string) => void; onChanged: () => void }) {
  const [tab, setTab] = useState<'profile' | 'applications' | 'certs' | 'audit'>('profile');
  const detail = trpc.admin.getSeekerDetail.useQuery({ seekerId });
  const utils = trpc.useUtils();
  const after = () => { void utils.admin.getSeekerDetail.invalidate({ seekerId }); onChanged(); };
  const verify = trpc.admin.verifyProfessional.useMutation({ onSuccess: after });
  const unverify = trpc.admin.unverifyProfessional.useMutation({ onSuccess: after });
  const unban = trpc.admin.unbanSeeker.useMutation({ onSuccess: after });
  const verifyCert = trpc.admin.verifyCert.useMutation({ onSuccess: after });
  const d = detail.data;
  const k = d?.seeker;

  return (
    <div style={s.overlay} onClick={onClose}>
      <aside style={s.panel} onClick={(ev) => ev.stopPropagation()}>
        <header style={s.panelHead}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ ...s.avatarLg, background: avatarColor(seekerId) }}>{initial(k?.name ?? null)}</span>
            <div>
              <h2 style={s.panelTitle}>{shortName(k?.name ?? null)}</h2>
              <p style={s.sub}>{k?.profession ?? ''} · {expLabel(k?.experienceMonths ?? null)}
                {k?.isVerified ? ' · ✅' : ''}{k?.isBanned ? ' · 🚫' : ''}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={s.close}>×</button>
        </header>

        <div style={s.panelTabs}>
          {([['profile', 'Profile'], ['applications', 'Applications'], ['certs', 'Certifications'], ['audit', 'Audit']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} style={{ ...s.panelTab, color: tab === key ? '#fff' : 'rgba(255,255,255,0.45)', borderBottom: tab === key ? '2px solid #3A9EA5' : '2px solid transparent' }}>{label}</button>
          ))}
        </div>

        <div style={s.panelBody}>
          {!d ? <p style={s.muted}>Loading…</p> : tab === 'profile' ? (
            <>
              <Row k="Profession" v={k!.profession ?? '—'} />
              <Row k="District" v={k!.district ?? '—'} />
              <Row k="Experience" v={expLabel(k!.experienceMonths)} />
              <Row k="Gulf experience" v={k!.openToGulf ? 'Yes' : 'No'} />
              <Row k="Active alerts" v={String(d.alertsCount)} />
              <Row k="Joined" v={relativeTime(k!.createdAt)} />
              <Row k="Last active" v={k!.lastLoginAt ? relativeTime(k!.lastLoginAt) : '—'} />
              <div style={{ margin: '12px 0' }}>
                <div style={s.detailK}>Profile completion · {k!.completionPct ?? 0}%</div>
                <div style={s.progressTrack}><div style={{ ...s.progressFill, width: `${k!.completionPct ?? 0}%` }} /></div>
              </div>
              {(k!.preferredCategories ?? []).length > 0 && (
                <div style={s.chipRow}>{k!.preferredCategories!.map((c) => <span key={c} style={s.chip}>{c}</span>)}</div>
              )}
              <div style={s.panelActions}>
                {!k!.isVerified
                  ? <button type="button" onClick={() => verify.mutate({ seekerId })} disabled={verify.isPending} style={s.btnVerify}>Verify Professional</button>
                  : <button type="button" onClick={() => { const x = prompt('Reason to unverify?'); if (x) unverify.mutate({ seekerId, reason: x }); }} style={s.btnGhost}>Unverify</button>}
                {k!.isBanned
                  ? <button type="button" onClick={() => unban.mutate({ seekerId })} style={s.btnVerify}>Unban</button>
                  : <button type="button" onClick={() => onBan(seekerId, shortName(k!.name))} style={s.btnBan}>Ban Account</button>}
              </div>
            </>
          ) : tab === 'applications' ? (
            d.applications.length === 0 ? <p style={s.muted}>No applications.</p> : d.applications.map((a) => (
              <div key={a.id} style={s.listItem}>
                <div>{a.jobTitle}<div style={s.sub}>{a.district ?? '—'} · {a.status} · {relativeTime(a.createdAt)}</div></div>
              </div>
            ))
          ) : tab === 'certs' ? (
            d.certifications.length === 0 ? <p style={s.muted}>No certifications submitted.</p> : d.certifications.map((c) => (
              <div key={c.id} style={s.listItem}>
                <div>{c.type}<div style={s.sub}>{c.number} · {c.status}</div></div>
                {c.status !== 'verified' && <button type="button" onClick={() => verifyCert.mutate({ certId: c.id })} disabled={verifyCert.isPending} style={s.btnVerify}>Verify</button>}
              </div>
            ))
          ) : (
            d.audit.length === 0 ? <p style={s.muted}>No audit entries.</p> : d.audit.map((a, i) => (
              <div key={i} style={s.listItem}><div>{a.action}<div style={s.sub}>{a.actorName ?? 'system'} · {relativeTime(a.createdAt)}</div></div></div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function BanModal({ target, onClose, onDone }: { target: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const ban = trpc.admin.banSeeker.useMutation({ onSuccess: onDone });
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(ev) => ev.stopPropagation()}>
        <h2 style={s.panelTitle}>Ban Seeker Account</h2>
        <p style={s.sub}>{target.name}</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (min 10 chars)…" rows={3} style={s.textarea} />
        <div style={s.chipRow}>
          {BAN_REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} style={s.chipBtn}>{r}</button>)}
        </div>
        <p style={s.warn}>This will prevent the user from logging in immediately.</p>
        <div style={s.modalActions}>
          <button type="button" onClick={onClose} style={s.btnGhost}>Cancel</button>
          <button type="button" disabled={reason.trim().length < 10 || ban.isPending} onClick={() => ban.mutate({ seekerId: target.id, reason: reason.trim() })} style={{ ...s.btnBan, opacity: reason.trim().length < 10 ? 0.5 : 1 }}>
            {ban.isPending ? 'Banning…' : 'Ban Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div style={s.detailRow}><span style={s.detailK}>{k}</span><span style={s.detailV}>{v}</span></div>;
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', padding: 'var(--space-3) var(--space-2)' },
  wrap: { maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 },
  back: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  exportBtn: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 },
  statCard: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' },
  statValue: { fontSize: 30, fontWeight: 700 },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  controls: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  search: { flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, outline: 'none' },
  select: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14 },
  tableCard: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 8, overflowX: 'auto' },
  muted: { color: 'rgba(255,255,255,0.4)', padding: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  theadRow: { color: 'rgba(255,255,255,0.4)', textAlign: 'left' },
  th: { padding: '10px 10px', fontWeight: 600, whiteSpace: 'nowrap' },
  thNum: { padding: '10px 10px', fontWeight: 600, textAlign: 'center' },
  thRight: { padding: '10px 10px', fontWeight: 600, textAlign: 'right' },
  row: { borderTop: '1px solid rgba(255,255,255,0.06)', color: '#e8e8e2' },
  td: { padding: '12px 10px', verticalAlign: 'middle' },
  tdNum: { padding: '12px 10px', textAlign: 'center' },
  tdRight: { padding: '12px 10px', textAlign: 'right' },
  seekerCell: { display: 'flex', gap: 10, alignItems: 'center' },
  avatar: { width: 34, height: 34, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  avatarLg: { width: 56, height: 56, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 22, flexShrink: 0 },
  nameLink: { background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  actions: { display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  btnGhost: { background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' },
  btnVerify: { background: '#2ec27a', color: '#08311c', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  btnBan: { background: '#E8623A', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' },
  panel: { width: 'min(480px,100%)', height: '100%', background: '#14201F', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' },
  panelTitle: { color: '#fff', fontSize: 20, fontFamily: 'var(--font-display)', fontStyle: 'italic', margin: 0 },
  close: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 28, lineHeight: 1, cursor: 'pointer' },
  panelTabs: { display: 'flex', gap: 4, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  panelTab: { background: 'none', border: 'none', padding: '12px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  panelBody: { padding: 20, overflowY: 'auto', flex: 1 },
  detailRow: { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  detailK: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  detailV: { color: '#fff', fontSize: 13, textAlign: 'right', wordBreak: 'break-word' },
  progressTrack: { height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, marginTop: 6 },
  progressFill: { height: '100%', background: '#3A9EA5', borderRadius: 4 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { background: 'rgba(58,158,165,0.2)', color: '#7fd4da', border: 'none', borderRadius: 999, padding: '4px 10px', fontSize: 12 },
  chipBtn: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 999, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  panelActions: { display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, color: '#fff', fontSize: 13, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  modal: { margin: 'auto', width: 'min(440px,100%)', background: '#14201F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: 12, fontSize: 14, marginTop: 12, outline: 'none' },
  warn: { color: '#E8623A', fontSize: 12, marginTop: 10 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
};
