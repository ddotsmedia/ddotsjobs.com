'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

const TEAL = '#3A9EA5';

function fmtBytes(n: number | null | undefined): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleString();
}
function daysLeft(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));
}

export function PrivacyData() {
  const utils = trpc.useUtils();
  const exportStatus = trpc.gdpr.getExportStatus.useQuery(undefined, { refetchInterval: (q) => (['pending', 'processing'].includes((q.state.data as { status?: string } | null)?.status ?? '') ? 4000 : false) });
  const deletion = trpc.gdpr.getDeletionStatus.useQuery();
  const requestExport = trpc.gdpr.requestDataExport.useMutation({ onSuccess: () => void utils.gdpr.getExportStatus.invalidate() });
  const requestDeletion = trpc.gdpr.requestDataDeletion.useMutation({ onSuccess: () => void utils.gdpr.getDeletionStatus.invalidate() });

  const [showAudit, setShowAudit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState('');

  const ex = exportStatus.data;
  const del = deletion.data;
  const delActive = del && ['pending', 'approved'].includes(del.status);

  return (
    <div style={s.wrap}>
      <p style={s.lead}>Manage your personal data under GDPR &amp; CCPA. Download everything we hold about you, review your activity log, or ask us to delete your account.</p>

      {/* Export */}
      <section style={s.card}>
        <h2 style={s.h2}>Download my data</h2>
        <p style={s.p}>We&apos;ll package your profile, applications, saved jobs, messages, posts and more into a single file. It may take a minute; we&apos;ll email you when it&apos;s ready.</p>

        {ex && ex.status === 'ready' && ex.downloadable ? (
          <div style={s.readyBox}>
            <div>
              <div style={s.readyTitle}>Your export is ready {ex.sizeBytes ? `(${fmtBytes(ex.sizeBytes)})` : ''}</div>
              <div style={s.readySub}>Download expires in {daysLeft(ex.expiresAt) ?? 30} days.</div>
            </div>
            <a href={ex.downloadUrl ?? '#'} style={s.downloadBtn}>Download</a>
          </div>
        ) : ex && ['pending', 'processing'].includes(ex.status) ? (
          <p style={s.pending}>Preparing your export… this page updates automatically.</p>
        ) : ex && ex.status === 'failed' ? (
          <p style={s.err}>The last export failed. Please try again.</p>
        ) : null}

        <button type="button" onClick={() => requestExport.mutate()} disabled={requestExport.isPending || (!!ex && ['pending', 'processing'].includes(ex.status))} style={s.primaryBtn}>
          {requestExport.isPending ? 'Requesting…' : ex && ex.status === 'ready' ? 'Request a fresh export' : 'Request my data export'}
        </button>
      </section>

      {/* Audit trail */}
      <section style={s.card}>
        <h2 style={s.h2}>Activity log</h2>
        <p style={s.p}>Recent account activity we&apos;ve recorded — logins, profile changes, applications and messages, with IP and device.</p>
        <button type="button" onClick={() => setShowAudit((v) => !v)} style={s.linkBtn}>{showAudit ? 'Hide activity log' : 'View activity log'}</button>
        {showAudit && <AuditTrail />}
      </section>

      {/* Deletion */}
      <section style={{ ...s.card, borderColor: '#f0d3cf' }}>
        <h2 style={{ ...s.h2, color: '#c0392b' }}>Delete my account</h2>
        <p style={s.p}>Request permanent deletion of your account and personal data. Legally required audit records are retained. This cannot be undone.</p>

        {delActive ? (
          <div style={s.statusBox}>
            <strong>Deletion {del!.status}.</strong> Requested {fmtDate(del!.requestedAt)}. {del!.status === 'pending' ? 'Awaiting review.' : 'Your data will be removed shortly.'}
          </div>
        ) : del && del.status === 'completed' ? (
          <div style={s.statusBox}>Your deletion request was completed on {fmtDate(del.completedAt)}.</div>
        ) : del && del.status === 'denied' ? (
          <div style={s.statusBox}>A previous request was denied. You may submit a new one.</div>
        ) : null}

        {!delActive && !confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)} style={s.dangerBtn}>Delete my account…</button>
        )}
        {!delActive && confirmDelete && (
          <div style={s.confirmBox}>
            <label style={s.label}>Reason (optional)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={2000} style={s.textarea} placeholder="Tell us why you're leaving (optional)" />
            </label>
            <p style={s.warn}>This permanently removes your access. Continue?</p>
            <div style={s.confirmRow}>
              <button type="button" onClick={() => requestDeletion.mutate({ reason: reason || undefined })} disabled={requestDeletion.isPending} style={s.dangerBtn}>{requestDeletion.isPending ? 'Submitting…' : 'Yes, delete my account'}</button>
              <button type="button" onClick={() => setConfirmDelete(false)} style={s.linkBtn}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AuditTrail() {
  const q = trpc.gdpr.viewAuditTrail.useQuery({ limit: 100 });
  const rows = q.data ?? [];
  if (q.isLoading) return <p style={s.p}>Loading…</p>;
  if (rows.length === 0) return <p style={s.p}>No activity recorded yet.</p>;
  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead><tr><th style={s.th}>Action</th><th style={s.th}>IP</th><th style={s.th}>When</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={s.tr}>
              <td style={s.td}>{r.action}</td>
              <td style={s.td}>{r.ipAddress ?? '—'}</td>
              <td style={s.td}>{fmtDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  lead: { fontSize: 14, color: '#55554f', lineHeight: 1.5, margin: 0 },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 10 },
  h2: { fontSize: 16, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  p: { fontSize: 13.5, color: '#3a3a34', lineHeight: 1.55, margin: 0 },
  primaryBtn: { alignSelf: 'flex-start', background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  linkBtn: { alignSelf: 'flex-start', background: 'none', border: 'none', color: TEAL, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 },
  dangerBtn: { alignSelf: 'flex-start', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  downloadBtn: { background: TEAL, color: '#fff', textDecoration: 'none', borderRadius: 'var(--radius-pill)', padding: '10px 20px', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' },
  readyBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: '#eef6f5', border: `1px solid ${TEAL}`, borderRadius: 12, padding: 'var(--space-2)', flexWrap: 'wrap' },
  readyTitle: { fontSize: 14, fontWeight: 700, color: '#1f6b70' },
  readySub: { fontSize: 12, color: '#4a7d7f' },
  pending: { fontSize: 13, color: '#9a6b00', margin: 0 },
  err: { fontSize: 13, color: '#c0392b', margin: 0 },
  statusBox: { background: '#f8f4e8', border: '1px solid #ecdcae', borderRadius: 10, padding: 'var(--space-2)', fontSize: 13, color: '#6b5a1f' },
  confirmBox: { display: 'flex', flexDirection: 'column', gap: 10, background: '#fdf3f2', border: '1px solid #f0d3cf', borderRadius: 12, padding: 'var(--space-2)' },
  label: { fontSize: 13, fontWeight: 600, color: '#3a3a34', display: 'flex', flexDirection: 'column', gap: 6 },
  textarea: { border: '1px solid #e2e2da', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' },
  warn: { fontSize: 13, color: '#c0392b', fontWeight: 600, margin: 0 },
  confirmRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 360 },
  th: { textAlign: 'left', padding: '6px 8px', color: '#8a8a83', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #efefe9' },
  tr: { borderBottom: '1px solid #f4f4ef' },
  td: { padding: '8px', color: '#2a2a26' },
};
