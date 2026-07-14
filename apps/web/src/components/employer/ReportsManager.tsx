'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

const TEAL = '#3A9EA5';
const TYPES = [
  { key: 'hiring_funnel', label: 'Hiring funnel' },
  { key: 'applicant_source', label: 'Applicant source' },
  { key: 'time_to_hire', label: 'Time to hire' },
] as const;
type ReportType = (typeof TYPES)[number]['key'];
const RANGES = [
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
] as const;
const DAY = 86_400_000;

function fmtDate(d: Date | string | null | undefined) {
  return d ? new Date(d).toLocaleDateString() : '—';
}

export function ReportsManager() {
  const utils = trpc.useUtils();
  const [type, setType] = useState<ReportType>('hiring_funnel');
  const [range, setRange] = useState<'30d' | '90d' | 'all'>('90d');
  const [busy, setBusy] = useState(false);

  const scheduled = trpc.reports.getScheduledReports.useQuery();
  const exportCsv = trpc.reports.exportAnalyticsAsCSV.useMutation();
  const schedule = trpc.reports.scheduleReport.useMutation({ onSuccess: () => void utils.reports.getScheduledReports.invalidate() });
  const update = trpc.reports.updateScheduledReport.useMutation({ onSuccess: () => void utils.reports.getScheduledReports.invalidate() });
  const del = trpc.reports.deleteScheduledReport.useMutation({ onSuccess: () => void utils.reports.getScheduledReports.invalidate() });

  const fromIso = () => {
    const cfg = RANGES.find((r) => r.key === range)!;
    return cfg.days ? new Date(Date.now() - cfg.days * DAY).toISOString() : undefined;
  };

  const downloadCsv = async () => {
    setBusy(true);
    try {
      const res = await exportCsv.mutateAsync({ reportType: type, from: fromIso() });
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const openPdf = () => {
    const p = new URLSearchParams({ type });
    const f = fromIso();
    if (f) p.set('from', f);
    window.open(`/employer/reports/print?${p.toString()}`, '_blank', 'noopener');
  };

  // Schedule form
  const [schedType, setSchedType] = useState<ReportType>('hiring_funnel');
  const [freq, setFreq] = useState<'weekly' | 'monthly'>('weekly');
  const [emails, setEmails] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const addSchedule = () => {
    setErr(null);
    const list = emails.split(',').map((e) => e.trim()).filter(Boolean);
    if (list.length === 0) { setErr('Add at least one recipient email.'); return; }
    schedule.mutate({ reportType: schedType, frequency: freq, recipients: list }, { onError: (e) => setErr(e.message), onSuccess: () => setEmails('') });
  };

  const rows = scheduled.data ?? [];

  return (
    <>
      <header style={s.head}>
        <div>
          <p style={s.eyebrow}>Employer</p>
          <h1 style={s.h1}>Reports</h1>
          <p style={s.sub}>Export hiring analytics or schedule email reports.</p>
        </div>
      </header>

      <section style={s.card}>
        <h2 style={s.h2}>Quick export</h2>
        <div style={s.controls}>
          <label style={s.field}>
            <span style={s.label}>Report</span>
            <select value={type} onChange={(e) => setType(e.target.value as ReportType)} style={s.select}>
              {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <label style={s.field}>
            <span style={s.label}>Range</span>
            <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} style={s.select}>
              {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
        </div>
        <div style={s.actions}>
          <button type="button" onClick={downloadCsv} disabled={busy} style={s.primaryBtn}>{busy ? 'Preparing…' : 'Download CSV'}</button>
          <button type="button" onClick={openPdf} style={s.ghostBtn}>Open PDF (print)</button>
        </div>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Schedule a report</h2>
        <div style={s.controls}>
          <label style={s.field}>
            <span style={s.label}>Report</span>
            <select value={schedType} onChange={(e) => setSchedType(e.target.value as ReportType)} style={s.select}>
              {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <label style={s.field}>
            <span style={s.label}>Frequency</span>
            <select value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)} style={s.select}>
              <option value="weekly">Weekly (Mon)</option>
              <option value="monthly">Monthly (1st)</option>
            </select>
          </label>
        </div>
        <label style={s.field}>
          <span style={s.label}>Recipient emails (comma-separated)</span>
          <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="you@company.com, hr@company.com" style={s.input} />
        </label>
        {err && <p style={s.err}>{err}</p>}
        <button type="button" onClick={addSchedule} disabled={schedule.isPending} style={s.primaryBtn}>{schedule.isPending ? 'Saving…' : 'Add scheduled report'}</button>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Scheduled reports</h2>
        {scheduled.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={s.muted}>No scheduled reports yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={s.schedRow}>
              <div style={{ minWidth: 0 }}>
                <div style={s.schedTitle}>{r.typeLabel} · <span style={s.schedFreq}>{r.frequency}</span></div>
                <div style={s.schedMeta}>{r.recipients.join(', ')}</div>
                <div style={s.schedMeta}>Last sent: {fmtDate(r.lastSentAt)}</div>
              </div>
              <div style={s.schedActions}>
                <button type="button" onClick={() => update.mutate({ id: r.id, isActive: !r.isActive })} style={{ ...s.pill, background: r.isActive ? '#1d7a3a' : '#b0ad9f' }}>{r.isActive ? 'Active' : 'Paused'}</button>
                <button type="button" onClick={() => { if (window.confirm('Delete this scheduled report?')) del.mutate({ id: r.id }); }} style={s.delBtn}>Delete</button>
              </div>
            </div>
          ))
        )}
        <p style={s.note}>Weekly reports send Monday, monthly on the 1st (≈9 AM IST), if scheduled reports are enabled by the site admin.</p>
      </section>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { marginBottom: 4 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEAL, margin: 0 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: '2px 0 0', color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: '4px 0 0' },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 12 },
  h2: { fontSize: 16, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  controls: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' },
  label: { fontSize: 12.5, fontWeight: 600, color: '#3a3a34' },
  select: { border: '1px solid #e2e2da', borderRadius: 10, padding: '10px 12px', fontSize: 14, minHeight: 42, background: '#fff' },
  input: { border: '1px solid #e2e2da', borderRadius: 10, padding: '10px 12px', fontSize: 14, minHeight: 42 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  primaryBtn: { alignSelf: 'flex-start', background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  ghostBtn: { background: '#fff', color: '#55554f', border: '1px solid #e2e2da', borderRadius: 'var(--radius-pill)', padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 },
  err: { fontSize: 13, color: '#c0392b', margin: 0 },
  muted: { color: '#8a8a83', fontSize: 14 },
  schedRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #f4f4ef' },
  schedTitle: { fontSize: 14, fontWeight: 700, color: '#1a1916' },
  schedFreq: { fontWeight: 500, color: '#6b6b66', textTransform: 'capitalize' },
  schedMeta: { fontSize: 12, color: '#8a8a83', marginTop: 2, wordBreak: 'break-word' },
  schedActions: { display: 'flex', gap: 8, flexShrink: 0 },
  pill: { color: '#fff', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  delBtn: { background: '#fff', color: '#c0392b', border: '1px solid #f0d3cf', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  note: { fontSize: 12, color: '#8a8a83', margin: 0 },
};
