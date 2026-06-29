'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { relativeTime } from '@/lib/format';

type StatusFilter = 'all' | 'pending' | 'verified' | 'suspended';
type PlanFilter = 'all' | 'free' | 'paid';

function rupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}
function maskPhone(p: string | null): string {
  if (!p) return '—';
  return p.length > 5 ? `${p.slice(0, 4)}…${p.slice(-3)}` : p;
}
function planBadge(tier: string): { label: string; bg: string } {
  if (tier === 'free') return { label: 'Free', bg: 'rgba(255,255,255,0.12)' };
  return { label: tier.replace(/^employer_/, '').replace(/_/g, ' '), bg: 'rgba(245,200,66,0.25)' };
}
const SUSPEND_REASONS = ['Fake job listings', 'Multiple complaints', 'Policy violation', 'Payment dispute'];

export function EmployerManagement() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [plan, setPlan] = useState<PlanFilter>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string } | null>(null);

  const stats = trpc.admin.employerStats.useQuery();
  const list = trpc.admin.getEmployers.useQuery({ search: search || undefined, status, plan, limit: 50, offset: 0 });

  function refresh() {
    void utils.admin.getEmployers.invalidate();
    void utils.admin.employerStats.invalidate();
  }
  const verify = trpc.admin.verifyEmployer.useMutation({ onSuccess: refresh });
  const unverify = trpc.admin.unverifyEmployer.useMutation({ onSuccess: refresh });

  function exportCsv() {
    const rows = list.data ?? [];
    const head = ['Company', 'Type', 'District', 'Plan', 'Status', 'Active jobs', 'Total jobs', 'Applications', 'Joined'];
    const body = rows.map((r) => [r.name, r.typeCode ?? '', r.district ?? '', r.tier, r.suspendedAt ? 'suspended' : r.verificationStatus, r.activeJobs, r.totalJobs, r.totalApplications, new Date(r.createdAt).toISOString().slice(0, 10)]);
    const csv = [head, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'employers.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const statCards = [
    { label: 'Total', value: stats.data?.total ?? 0 },
    { label: 'Pending', value: stats.data?.pending ?? 0 },
    { label: 'Verified', value: stats.data?.verified ?? 0 },
    { label: 'Suspended', value: stats.data?.suspended ?? 0 },
    { label: 'Paid plans', value: stats.data?.paid ?? 0 },
  ];

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div>
            <h1 style={s.h1}>Employer Management</h1>
            <Link href="/admin/dashboard" style={s.back}>← Dashboard</Link>
          </div>
          <button type="button" onClick={exportCsv} style={s.exportBtn}>Export CSV</button>
        </header>

        <section style={s.statsRow}>
          {statCards.map((c) => (
            <div key={c.label} style={s.statCard}>
              <div style={{ ...s.statValue, color: c.label === 'Suspended' && c.value > 0 ? '#E8623A' : '#3A9EA5' }}>{c.value}</div>
              <div style={s.statLabel}>{c.label}</div>
            </div>
          ))}
        </section>

        <div style={s.controls}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company name…" style={s.search} />
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} style={s.select}>
            <option value="all">All status</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="suspended">Suspended</option>
          </select>
          <select value={plan} onChange={(e) => setPlan(e.target.value as PlanFilter)} style={s.select}>
            <option value="all">All plans</option><option value="free">Free</option><option value="paid">Paid</option>
          </select>
        </div>

        {(stats.data?.pending ?? 0) > 0 && status !== 'pending' && (
          <button type="button" onClick={() => setStatus('pending')} style={s.pendingBanner}>
            ⚠️ {stats.data!.pending} employer{stats.data!.pending > 1 ? 's' : ''} awaiting verification — click to view
          </button>
        )}

        <div style={s.tableCard}>
          {list.isLoading ? (
            <p style={s.muted}>Loading…</p>
          ) : list.isError ? (
            <p style={{ color: '#E8623A' }}>Failed to load employers.</p>
          ) : (list.data ?? []).length === 0 ? (
            <p style={s.muted}>No employers match.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr style={s.theadRow}>
                  <th style={s.th}>Company</th><th style={s.th}>District</th><th style={s.th}>Plan</th>
                  <th style={s.th}>Status</th><th style={s.thNum}>Jobs</th><th style={s.thNum}>Apps</th>
                  <th style={s.th}>Joined</th><th style={s.thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data!.map((r) => {
                  const pb = planBadge(r.tier);
                  const suspended = !!r.suspendedAt;
                  return (
                    <tr key={r.id} style={s.row}>
                      <td style={s.td}>
                        <button type="button" onClick={() => setDetailId(r.id)} style={s.companyLink}>{r.name}</button>
                        <div style={s.sub}>{r.typeCode ?? '—'} · {maskPhone(r.phone)}</div>
                      </td>
                      <td style={s.td}>{r.district ?? '—'}</td>
                      <td style={s.td}><span style={{ ...s.badge, background: pb.bg }}>{pb.label}</span></td>
                      <td style={s.td}>
                        {suspended ? <span style={{ color: '#E8623A' }}>🚫 Suspended</span>
                          : r.verificationStatus === 'verified' ? <span style={{ color: '#2ec27a' }}>✅ Verified</span>
                          : <span style={{ color: '#F5C842' }}>⏳ Pending</span>}
                      </td>
                      <td style={s.tdNum}>{r.activeJobs}/{r.totalJobs}</td>
                      <td style={s.tdNum}>{r.totalApplications}</td>
                      <td style={s.td}>{relativeTime(r.createdAt)}</td>
                      <td style={s.tdRight}>
                        <div style={s.actions}>
                          <button type="button" onClick={() => setDetailId(r.id)} style={s.btnGhost}>Details</button>
                          {r.verificationStatus !== 'verified' ? (
                            <button type="button" onClick={() => verify.mutate({ employerId: r.id })} disabled={verify.isPending} style={s.btnVerify}>Verify</button>
                          ) : (
                            <button type="button" onClick={() => { const reason = prompt('Reason to unverify?'); if (reason) unverify.mutate({ employerId: r.id, reason }); }} style={s.btnGhost}>Unverify</button>
                          )}
                          <button type="button" onClick={() => setSuspendTarget({ id: r.id, name: r.name })} style={s.btnSuspend}>Suspend</button>
                          <a href={`https://wa.me/${(r.phone ?? '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={s.btnGhost}>WhatsApp</a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detailId && <DetailPanel employerId={detailId} onClose={() => setDetailId(null)} onSuspend={(id, name) => { setDetailId(null); setSuspendTarget({ id, name }); }} onChanged={refresh} />}
      {suspendTarget && <SuspendModal target={suspendTarget} onClose={() => setSuspendTarget(null)} onDone={() => { setSuspendTarget(null); refresh(); }} />}
    </main>
  );
}

function DetailPanel({ employerId, onClose, onSuspend, onChanged }: { employerId: string; onClose: () => void; onSuspend: (id: string, name: string) => void; onChanged: () => void }) {
  const [tab, setTab] = useState<'info' | 'jobs' | 'payments' | 'audit'>('info');
  const detail = trpc.admin.getEmployerDetail.useQuery({ employerId });
  const utils = trpc.useUtils();
  const after = () => { void utils.admin.getEmployerDetail.invalidate({ employerId }); onChanged(); };
  const verify = trpc.admin.verifyEmployer.useMutation({ onSuccess: after });
  const unverify = trpc.admin.unverifyEmployer.useMutation({ onSuccess: after });
  const d = detail.data;
  const e = d?.employer;

  return (
    <div style={s.overlay} onClick={onClose}>
      <aside style={s.panel} onClick={(ev) => ev.stopPropagation()}>
        <header style={s.panelHead}>
          <div>
            <h2 style={s.panelTitle}>{e?.name ?? 'Loading…'}</h2>
            <p style={s.sub}>{e?.typeCode ?? ''} · {e?.district ?? ''}</p>
          </div>
          <button type="button" onClick={onClose} style={s.close}>×</button>
        </header>

        <div style={s.panelTabs}>
          {(['info', 'jobs', 'payments', 'audit'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{ ...s.panelTab, color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)', borderBottom: tab === t ? '2px solid #3A9EA5' : '2px solid transparent' }}>{t}</button>
          ))}
        </div>

        <div style={s.panelBody}>
          {!d ? <p style={s.muted}>Loading…</p> : tab === 'info' ? (
            <>
              <Row k="Contact" v={e!.contactName ?? '—'} />
              <Row k="Phone" v={e!.phone ?? '—'} />
              <Row k="Email" v={e!.email ?? '—'} />
              <Row k="GST" v={e!.gstin ?? '—'} />
              <Row k="Website" v={e!.websiteUrl ?? '—'} />
              <Row k="Size" v={e!.companySize ?? '—'} />
              <Row k="Established" v={e!.yearEstablished ? String(e!.yearEstablished) : '—'} />
              <Row k="Plan" v={e!.tier} />
              <Row k="Total revenue" v={rupees(d.totalRevenue)} />
              <Row k="Registered" v={relativeTime(e!.createdAt)} />
              {e!.suspendedAt && <Row k="Suspended" v={e!.suspensionReason ?? 'yes'} />}
              <div style={s.panelActions}>
                {e!.verificationStatus !== 'verified'
                  ? <button type="button" onClick={() => verify.mutate({ employerId })} disabled={verify.isPending} style={s.btnVerify}>Verify</button>
                  : <button type="button" onClick={() => { const r = prompt('Reason to unverify?'); if (r) unverify.mutate({ employerId, reason: r }); }} style={s.btnGhost}>Unverify</button>}
                <button type="button" onClick={() => onSuspend(employerId, e!.name)} style={s.btnSuspend}>Suspend</button>
                <a href={`https://wa.me/${(e!.phone ?? '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={s.btnGhost}>WhatsApp</a>
              </div>
            </>
          ) : tab === 'jobs' ? (
            d.jobs.length === 0 ? <p style={s.muted}>No jobs.</p> : d.jobs.map((j) => (
              <div key={j.id} style={s.listItem}>
                <div>{j.title}<div style={s.sub}>{j.status} · {j.applicationCount} apps · {relativeTime(j.createdAt)}</div></div>
                {j.slug && <a href={`/jobs/${j.slug}`} target="_blank" rel="noopener noreferrer" style={s.linkSm}>View →</a>}
              </div>
            ))
          ) : tab === 'payments' ? (
            d.payments.length === 0 ? <p style={s.muted}>No payments.</p> : d.payments.map((p) => (
              <div key={p.id} style={s.listItem}>
                <div>{rupees(p.amountPaise)}<div style={s.sub}>{p.status} · {relativeTime(p.createdAt)}</div></div>
              </div>
            ))
          ) : (
            d.audit.length === 0 ? <p style={s.muted}>No audit entries.</p> : d.audit.map((a, i) => (
              <div key={i} style={s.listItem}>
                <div>{a.action}<div style={s.sub}>{a.actorName ?? 'system'} · {relativeTime(a.createdAt)}</div></div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function SuspendModal({ target, onClose, onDone }: { target: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(30);
  const suspend = trpc.admin.suspendEmployer.useMutation({ onSuccess: onDone });
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(ev) => ev.stopPropagation()}>
        <h2 style={s.panelTitle}>Suspend Employer</h2>
        <p style={s.sub}>{target.name}</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for suspension…" rows={3} style={s.textarea} />
        <div style={s.chips}>
          {SUSPEND_REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} style={s.chip}>{r}</button>)}
        </div>
        <div style={s.durations}>
          {[{ d: 7, l: '7 days' }, { d: 30, l: '30 days' }, { d: 90, l: '90 days' }, { d: 0, l: 'Permanent' }].map((o) => (
            <button key={o.d} type="button" onClick={() => setDays(o.d)} style={{ ...s.durBtn, background: days === o.d ? '#3A9EA5' : 'rgba(255,255,255,0.08)', color: days === o.d ? '#fff' : 'rgba(255,255,255,0.6)' }}>{o.l}</button>
          ))}
        </div>
        <div style={s.modalActions}>
          <button type="button" onClick={onClose} style={s.btnGhost}>Cancel</button>
          <button type="button" disabled={reason.trim().length < 3 || suspend.isPending} onClick={() => suspend.mutate({ employerId: target.id, reason: reason.trim(), days })} style={{ ...s.btnSuspend, opacity: reason.trim().length < 3 ? 0.5 : 1 }}>
            {suspend.isPending ? 'Suspending…' : 'Suspend Employer'}
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
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 },
  statCard: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' },
  statValue: { fontSize: 30, fontWeight: 700 },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  controls: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  search: { flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, outline: 'none' },
  select: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14 },
  pendingBanner: { textAlign: 'left', background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.4)', color: '#F5C842', borderRadius: 10, padding: '12px 16px', fontSize: 14, cursor: 'pointer' },
  tableCard: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 8, overflowX: 'auto' },
  muted: { color: 'rgba(255,255,255,0.4)', padding: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  theadRow: { color: 'rgba(255,255,255,0.4)', textAlign: 'left' },
  th: { padding: '10px 10px', fontWeight: 600, whiteSpace: 'nowrap' },
  thNum: { padding: '10px 10px', fontWeight: 600, textAlign: 'center' },
  thRight: { padding: '10px 10px', fontWeight: 600, textAlign: 'right' },
  row: { borderTop: '1px solid rgba(255,255,255,0.06)', color: '#e8e8e2' },
  td: { padding: '12px 10px', verticalAlign: 'top' },
  tdNum: { padding: '12px 10px', textAlign: 'center' },
  tdRight: { padding: '12px 10px', textAlign: 'right' },
  companyLink: { background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  badge: { fontSize: 11, padding: '3px 8px', borderRadius: 999, color: '#fff', textTransform: 'capitalize' },
  actions: { display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  btnGhost: { background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer', textDecoration: 'none' },
  btnVerify: { background: '#2ec27a', color: '#08311c', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  btnSuspend: { background: '#E8623A', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' },
  panel: { width: 'min(480px,100%)', height: '100%', background: '#14201F', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' },
  panelTitle: { color: '#fff', fontSize: 20, fontFamily: 'var(--font-display)', fontStyle: 'italic', margin: 0 },
  close: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 28, lineHeight: 1, cursor: 'pointer' },
  panelTabs: { display: 'flex', gap: 4, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  panelTab: { background: 'none', border: 'none', padding: '12px 12px', fontSize: 13, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer' },
  panelBody: { padding: 20, overflowY: 'auto', flex: 1 },
  detailRow: { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  detailK: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  detailV: { color: '#fff', fontSize: 13, textAlign: 'right', wordBreak: 'break-word' },
  panelActions: { display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, color: '#fff', fontSize: 13, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  linkSm: { color: '#3A9EA5', fontSize: 12 },
  modal: { margin: 'auto', width: 'min(440px,100%)', background: '#14201F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: 12, fontSize: 14, marginTop: 12, outline: 'none' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 999, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  durations: { display: 'flex', gap: 6, marginTop: 12 },
  durBtn: { flex: 1, border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
};
