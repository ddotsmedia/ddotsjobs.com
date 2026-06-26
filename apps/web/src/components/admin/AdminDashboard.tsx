'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { inferRouterOutputs } from '@trpc/server';
import { trpc } from '@/lib/trpc/client';
import type { AppRouter } from '@/server/routers/_app';
import { relativeTime } from '@/lib/format';

type Out = inferRouterOutputs<AppRouter>;
type QueueRow = Out['admin']['moderationQueue'][number];

function rupees(paise: number | null): string {
  if (paise == null) return '—';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

function salaryLabel(r: QueueRow): string {
  if (!r.salaryDisclosed) return 'Market rate';
  if (r.salaryMinPaise == null && r.salaryMaxPaise == null) return 'Not stated';
  if (r.salaryMinPaise != null && r.salaryMaxPaise != null) return `${rupees(r.salaryMinPaise)}–${rupees(r.salaryMaxPaise)}`;
  return rupees(r.salaryMinPaise ?? r.salaryMaxPaise);
}

function riskColor(score: number | null): { bg: string; fg: string; label: string } {
  if (score == null) return { bg: '#6b6b6622', fg: '#9a9a92', label: 'No score' };
  if (score <= 30) return { bg: '#1f7a3d22', fg: '#2ec27a', label: `${score}` };
  if (score <= 70) return { bg: '#b8860022', fg: '#e0a72e', label: `${score}` };
  return { bg: '#c0392b22', fg: '#e74c3c', label: `${score}` };
}

const NAV = ['Overview', 'Moderation', 'Employers', 'Users', 'Audit Log', 'Settings'];

function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 3)}…${phone.slice(-4)}`;
}

export function AdminDashboard() {
  const router = useRouter();
  const [dark, setDark] = useState(true);
  const t = useMemo(() => makeTheme(dark), [dark]);
  const [now, setNow] = useState<string>('');

  // Persisted theme preference.
  useEffect(() => {
    const saved = localStorage.getItem('ddj-admin-theme');
    if (saved) setDark(saved === 'dark');
  }, []);
  function toggleTheme() {
    setDark((v) => {
      const next = !v;
      localStorage.setItem('ddj-admin-theme', next ? 'dark' : 'light');
      return next;
    });
  }

  // IST clock.
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);

  const utils = trpc.useUtils();
  const metrics = trpc.admin.metrics.useQuery();
  const queue = trpc.admin.moderationQueue.useQuery({ limit: 20, offset: 0 });
  const newEmployers = trpc.admin.newEmployers.useQuery();
  const stats7d = trpc.admin.jobStats7d.useQuery();
  const coverage = trpc.admin.districtCoverage.useQuery();
  const audit = trpc.admin.recentAuditLog.useQuery();

  function invalidateModeration() {
    void utils.admin.moderationQueue.invalidate();
    void utils.admin.metrics.invalidate();
    void utils.admin.recentAuditLog.invalidate();
  }
  const approveJob = trpc.admin.approveJob.useMutation({ onSuccess: invalidateModeration });
  const rejectJob = trpc.admin.rejectJob.useMutation({ onSuccess: invalidateModeration });
  const approveEmployer = trpc.admin.approveEmployer.useMutation({
    onSuccess: () => {
      void utils.admin.newEmployers.invalidate();
      void utils.admin.metrics.invalidate();
      void utils.admin.recentAuditLog.invalidate();
    },
  });

  const m = metrics.data;
  const metricCards: { label: string; value: number }[] = [
    { label: 'Active jobs', value: m?.totalActiveJobs ?? 0 },
    { label: 'Total seekers', value: m?.totalSeekers ?? 0 },
    { label: 'Verified employers', value: m?.verifiedEmployers ?? 0 },
    { label: 'Pending review', value: m?.pendingJobs ?? 0 },
    { label: 'Jobs today', value: m?.jobsToday ?? 0 },
  ];

  return (
    <div style={{ ...st.shell, background: t.bg, color: t.fg }}>
      {/* Sidebar */}
      <aside style={{ ...st.sidebar, background: t.panel, borderColor: t.border }}>
        <div style={st.brandRow}>
          <span style={{ ...st.brand, color: t.accent }}>ddotsjobs admin</span>
          <span style={st.adminBadge}>Admin</span>
        </div>
        <nav style={st.nav}>
          {NAV.map((n, i) => (
            <a
              key={n}
              href={`#${n.toLowerCase().replace(/\s+/g, '-')}`}
              style={{ ...st.navItem, color: i === 0 ? t.fg : t.muted, background: i === 0 ? t.activeNav : 'transparent' }}
            >
              {n}
            </a>
          ))}
        </nav>
        <button type="button" onClick={toggleTheme} style={{ ...st.themeToggle, borderColor: t.border, color: t.fg }}>
          {dark ? '☀ Light mode' : '🌙 Dark mode'}
        </button>
      </aside>

      {/* Main */}
      <main style={st.main}>
        <header id="overview" style={st.headerRow}>
          <div>
            <h1 style={st.h1}>Admin — Platform overview</h1>
            <p style={{ ...st.clock, color: t.muted }}>{now} IST</p>
          </div>
          <button type="button" onClick={() => router.refresh()} style={{ ...st.refreshBtn, borderColor: t.border, color: t.fg }}>↻ Refresh</button>
        </header>

        {/* Metrics */}
        <section style={st.metricsGrid}>
          {metricCards.map((c) => (
            <div key={c.label} style={{ ...st.metricCard, background: t.panel, borderColor: t.border }}>
              <div style={{ ...st.metricValue, color: t.accent }}>{c.value.toLocaleString('en-IN')}</div>
              <div style={{ ...st.metricLabel, color: t.muted }}>{c.label}</div>
            </div>
          ))}
        </section>

        <div style={st.columns}>
          {/* Left */}
          <div style={st.colLeft}>
            <h2 id="moderation" style={st.h2}>Moderation queue</h2>
            <div style={{ ...st.card, background: t.panel, borderColor: t.border }}>
              {queue.isLoading ? (
                <p style={{ color: t.muted }}>Loading…</p>
              ) : (queue.data ?? []).length === 0 ? (
                <p style={{ color: t.muted }}>Nothing pending review. 🎉</p>
              ) : (
                <table style={st.table}>
                  <thead>
                    <tr style={{ color: t.muted }}>
                      <th style={st.th}>Job</th>
                      <th style={st.th}>Salary</th>
                      <th style={st.th}>Risk</th>
                      <th style={st.thRight}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.data!.map((row) => (
                      <ModerationRow
                        key={row.id}
                        row={row}
                        theme={t}
                        approving={approveJob.isPending && approveJob.variables?.jobId === row.id}
                        rejecting={rejectJob.isPending && rejectJob.variables?.jobId === row.id}
                        onApprove={() => approveJob.mutate({ jobId: row.id })}
                        onReject={(reason) => rejectJob.mutate({ jobId: row.id, reason })}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <h2 id="employers" style={st.h2}>New employer registrations</h2>
            <div style={{ ...st.card, background: t.panel, borderColor: t.border }}>
              {(newEmployers.data ?? []).length === 0 ? (
                <p style={{ color: t.muted }}>No pending employers.</p>
              ) : (
                <table style={st.table}>
                  <thead>
                    <tr style={{ color: t.muted }}>
                      <th style={st.th}>Company</th>
                      <th style={st.th}>Type</th>
                      <th style={st.th}>District</th>
                      <th style={st.th}>Phone</th>
                      <th style={st.th}>GST</th>
                      <th style={st.thRight}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newEmployers.data!.map((e) => (
                      <tr key={e.id} style={{ borderTop: `1px solid ${t.border}` }}>
                        <td style={st.td}>{e.companyName}<div style={{ ...st.sub, color: t.muted }}>{relativeTime(e.createdAt)} · {e.jobCount} jobs</div></td>
                        <td style={st.td}>{e.employerType}</td>
                        <td style={st.td}>{e.district ?? '—'}</td>
                        <td style={{ ...st.td, fontFamily: 'var(--font-mono)' }}>{maskPhone(e.phone)}</td>
                        <td style={st.td}>{e.gstin ? <span style={{ color: '#2ec27a' }}>✓ {e.gstin}</span> : <span style={{ color: t.muted }}>—</span>}</td>
                        <td style={st.tdRight}>
                          <button
                            type="button"
                            onClick={() => approveEmployer.mutate({ employerId: e.id })}
                            disabled={approveEmployer.isPending && approveEmployer.variables?.employerId === e.id}
                            style={st.btnApprove}
                          >
                            Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right */}
          <div style={st.colRight}>
            <h2 id="analytics" style={st.h2}>Job posts · 7 days</h2>
            <div style={{ ...st.card, background: t.panel, borderColor: t.border }}>
              <BarChart7d data={stats7d.data ?? []} theme={t} />
            </div>

            <h2 style={st.h2}>District coverage</h2>
            <div style={{ ...st.card, background: t.panel, borderColor: t.border }}>
              <DistrictBars data={coverage.data ?? []} theme={t} />
            </div>

            <h2 id="audit-log" style={st.h2}>Audit log</h2>
            <div style={{ ...st.card, background: t.panel, borderColor: t.border }}>
              {(audit.data ?? []).length === 0 ? (
                <p style={{ color: t.muted }}>No activity yet.</p>
              ) : (
                <ul style={st.auditList}>
                  {audit.data!.map((a, i) => (
                    <li key={i} style={{ ...st.auditItem, borderColor: t.border }}>
                      <span style={st.auditAction}>{a.action}</span>
                      <span style={{ ...st.sub, color: t.muted }}>
                        {a.entityType} · {a.actorName ?? 'system'} · {relativeTime(a.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

type Theme = ReturnType<typeof makeTheme>;

function ModerationRow({
  row, theme, onApprove, onReject, approving, rejecting,
}: {
  row: QueueRow; theme: Theme; onApprove: () => void; onReject: (reason: string) => void; approving: boolean; rejecting: boolean;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const risk = riskColor(row.riskScore);
  return (
    <>
      <tr style={{ borderTop: `1px solid ${theme.border}` }}>
        <td style={st.td}>
          {row.title}
          <div style={{ ...st.sub, color: theme.muted }}>
            {row.companyName}{row.isVerified ? ' ✓' : ''} · {row.district ?? '—'} · {row.employerTotalJobs} jobs
          </div>
        </td>
        <td style={st.td}>{salaryLabel(row)}</td>
        <td style={st.td}>
          <span style={{ ...st.riskBadge, background: risk.bg, color: risk.fg }}>{risk.label}</span>
        </td>
        <td style={st.tdRight}>
          <div style={st.actionBtns}>
            <button type="button" onClick={onApprove} disabled={approving} style={st.btnApprove}>
              {approving ? '…' : 'Approve'}
            </button>
            <button type="button" onClick={() => setRejectOpen((v) => !v)} style={st.btnReject}>Reject</button>
          </div>
        </td>
      </tr>
      {rejectOpen && (
        <tr>
          <td colSpan={4} style={{ ...st.td, paddingTop: 0 }}>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (min 10 chars) — sent to the employer"
              rows={2}
              style={{ ...st.textarea, background: theme.bg, color: theme.fg, borderColor: theme.border }}
            />
            <div style={st.actionBtns}>
              <button
                type="button"
                disabled={reason.trim().length < 10 || rejecting}
                onClick={() => { onReject(reason.trim()); setRejectOpen(false); setReason(''); }}
                style={{ ...st.btnReject, opacity: reason.trim().length < 10 ? 0.5 : 1 }}
              >
                {rejecting ? 'Rejecting…' : 'Confirm reject'}
              </button>
              <button type="button" onClick={() => setRejectOpen(false)} style={{ ...st.btnGhost, color: theme.muted }}>Cancel</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function BarChart7d({ data, theme }: { data: Out['admin']['jobStats7d']; theme: Theme }) {
  if (data.length === 0) return <p style={{ color: theme.muted }}>No data.</p>;
  const max = Math.max(...data.map((d) => d.jobCount), 1);
  return (
    <div style={st.barChart}>
      {data.map((d) => (
        <div key={d.date} style={st.barCol}>
          <span style={{ ...st.barCount, color: theme.fg }}>{d.jobCount}</span>
          <div style={{ ...st.bar, height: `${Math.round((d.jobCount / max) * 120) + 4}px`, background: theme.accent }} />
          <span style={{ ...st.barLabel, color: theme.muted }}>{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function DistrictBars({ data, theme }: { data: Out['admin']['districtCoverage']; theme: Theme }) {
  if (data.length === 0) return <p style={{ color: theme.muted }}>No active jobs.</p>;
  const max = Math.max(...data.map((d) => d.jobCount), 1);
  return (
    <div style={st.districtList}>
      {data.map((d) => (
        <div key={d.district ?? 'none'} style={st.districtRow}>
          <span style={{ ...st.districtName, color: theme.fg }}>{d.district ?? '—'}</span>
          <div style={st.districtTrack}>
            <div style={{ ...st.districtBar, width: `${Math.round((d.jobCount / max) * 100)}%`, background: theme.accent }} />
          </div>
          <span style={{ ...st.districtCount, color: theme.muted }}>{d.jobCount}</span>
        </div>
      ))}
    </div>
  );
}

function makeTheme(dark: boolean) {
  return dark
    ? { bg: '#0F0E0C', panel: '#1A1916', border: '#2c2a25', fg: '#F0EFE8', muted: '#9a9a92', accent: '#e0a72e', activeNav: '#2c2a2566' }
    : { bg: '#faf9f5', panel: '#ffffff', border: '#e2e2dc', fg: '#0f0e0c', muted: '#6b6b66', accent: '#b8860b', activeNav: '#f1f1ec' };
}

const st: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100dvh', display: 'flex', flexDirection: 'row', fontFamily: 'var(--font-sans)' },
  sidebar: { width: 220, flex: '0 0 220px', borderRight: '1px solid', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'sticky', top: 0, height: '100dvh' },
  brandRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  brand: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.25rem' },
  adminBadge: { alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, color: '#fff', background: '#c0392b', padding: '2px 8px', borderRadius: 'var(--radius-pill)' },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  navItem: { textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '8px 10px', borderRadius: 8 },
  themeToggle: { background: 'none', border: '1px solid', borderRadius: 'var(--radius-pill)', padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  main: { flex: 1, minWidth: 0, padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)', flexWrap: 'wrap' },
  clock: { fontSize: 13, margin: '4px 0 0' },
  refreshBtn: { background: 'none', border: '1px solid', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,5vw,2.4rem)', margin: 0 },
  h2: { fontSize: '1.1rem', fontWeight: 700, margin: 'var(--space-2) 0 8px' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-2)' },
  metricCard: { border: '1px solid', borderRadius: 'var(--radius-card)', padding: 'var(--space-2)' },
  metricValue: { fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.1 },
  metricLabel: { fontSize: 13, marginTop: 4 },
  columns: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'flex-start' },
  colLeft: { flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column' },
  colRight: { flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column' },
  card: { border: '1px solid', borderRadius: 'var(--radius-card)', padding: 'var(--space-2)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', fontSize: 12, fontWeight: 600, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.4 },
  thRight: { textAlign: 'right', fontSize: 12, fontWeight: 600, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.4 },
  td: { padding: '10px 8px', verticalAlign: 'top' },
  tdRight: { padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' },
  sub: { fontSize: 12, marginTop: 2 },
  riskBadge: { display: 'inline-block', minWidth: 32, textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)' },
  actionBtns: { display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 6 },
  btnApprove: { background: '#1f7a3d', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 34 },
  btnReject: { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 34 },
  btnGhost: { background: 'none', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  textarea: { width: '100%', border: '1px solid', borderRadius: 8, padding: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' },
  barChart: { display: 'flex', alignItems: 'flex-end', gap: 8, height: 170, paddingTop: 8 },
  barCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', borderRadius: '4px 4px 0 0', minHeight: 4 },
  barCount: { fontSize: 12, fontWeight: 700 },
  barLabel: { fontSize: 11 },
  districtList: { display: 'flex', flexDirection: 'column', gap: 6 },
  districtRow: { display: 'flex', alignItems: 'center', gap: 8 },
  districtName: { fontSize: 12, width: 110, flex: '0 0 110px', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  districtTrack: { flex: 1, height: 10, background: '#80808022', borderRadius: 'var(--radius-pill)', overflow: 'hidden' },
  districtBar: { height: '100%', borderRadius: 'var(--radius-pill)' },
  districtCount: { fontSize: 12, width: 36, flex: '0 0 36px', textAlign: 'right' },
  auditList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-mono)' },
  auditItem: { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: '1px solid', fontSize: 12 },
  auditAction: { fontWeight: 600 },
};
