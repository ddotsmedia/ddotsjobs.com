'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { relativeTime } from '@/lib/format';

const TEAL = '#3A9EA5';
const EVENTS = ['job_posted', 'application_received', 'application_stage_changed', 'offer_sent', 'application_rejected'] as const;

export function WebhooksManager() {
  const utils = trpc.useUtils();
  const q = trpc.webhook.getWebhooks.useQuery();
  const create = trpc.webhook.createWebhook.useMutation({ onSuccess: (r) => { setFreshSecret(r.secret); setUrl(''); setEvents(['application_received']); void utils.webhook.getWebhooks.invalidate(); } });
  const update = trpc.webhook.updateWebhook.useMutation({ onSuccess: () => void utils.webhook.getWebhooks.invalidate() });
  const del = trpc.webhook.deleteWebhook.useMutation({ onSuccess: () => void utils.webhook.getWebhooks.invalidate() });
  const test = trpc.webhook.testWebhook.useMutation();
  const rotate = trpc.webhook.rotateWebhookSecret.useMutation({ onSuccess: (r) => setFreshSecret(r.secret) });

  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['application_received']);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openLogs, setOpenLogs] = useState<string | null>(null);
  const [tested, setTested] = useState<string | null>(null);

  const toggleEvent = (e: string) => setEvents((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));
  const onCreate = () => {
    setErr(null);
    if (!url.startsWith('https://')) { setErr('URL must be HTTPS.'); return; }
    if (events.length === 0) { setErr('Select at least one event.'); return; }
    create.mutate({ url, events: events as never }, { onError: (e) => setErr(e.message) });
  };

  const rows = q.data ?? [];

  return (
    <>
      <header style={s.head}>
        <div>
          <h1 style={s.h1}>Webhooks</h1>
          <p style={s.sub}>Receive events at your endpoint. <Link href="/docs/webhooks" style={s.docLink}>Webhook docs →</Link></p>
        </div>
      </header>

      {freshSecret && (
        <div style={s.fresh}>
          <p style={s.freshLabel}>Signing secret — store it to verify the X-Signature header:</p>
          <div style={s.keyRow}><code style={s.keyCode}>{freshSecret}</code><button type="button" onClick={() => void navigator.clipboard?.writeText(freshSecret)} style={s.copyBtn}>Copy</button></div>
          <button type="button" onClick={() => setFreshSecret(null)} style={s.dismiss}>Dismiss</button>
        </div>
      )}

      <section style={s.card}>
        <h2 style={s.h2}>Add a webhook</h2>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/ddotsjobs" style={s.input} />
        <div style={s.eventGrid}>
          {EVENTS.map((e) => (
            <label key={e} style={s.evt}><input type="checkbox" checked={events.includes(e)} onChange={() => toggleEvent(e)} style={s.check} />{e}</label>
          ))}
        </div>
        {err && <p style={s.err}>{err}</p>}
        <button type="button" onClick={onCreate} disabled={create.isPending} style={s.createBtn}>{create.isPending ? 'Creating…' : 'Create webhook'}</button>
      </section>

      {q.isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={s.muted}>No webhooks yet.</p>
      ) : (
        rows.map((w) => (
          <section key={w.id} style={s.card}>
            <div style={s.whHead}>
              <div style={{ minWidth: 0 }}>
                <div style={s.whUrl}>{w.url}</div>
                <div style={s.whMeta}>{(w.events ?? []).join(', ') || 'no events'} · {w.lastTriggeredAt ? `last ${relativeTime(w.lastTriggeredAt)}` : 'never triggered'}</div>
              </div>
              <button type="button" onClick={() => update.mutate({ webhookId: w.id, isActive: !w.isActive })} style={{ ...s.activeBtn, background: w.isActive ? '#1d7a3a' : '#b0ad9f' }}>{w.isActive ? 'Active' : 'Paused'}</button>
            </div>
            <details style={s.secretDetails}><summary style={s.secretSummary}>Show signing secret</summary><code style={s.secretCode}>{w.secret}</code></details>
            <div style={s.whActions}>
              <button type="button" onClick={() => { test.mutate({ webhookId: w.id }); setTested(w.id); }} style={s.actBtn}>{test.isPending && tested === w.id ? 'Sending…' : 'Send test'}</button>
              <button type="button" onClick={() => setOpenLogs(openLogs === w.id ? null : w.id)} style={s.actBtn}>{openLogs === w.id ? 'Hide logs' : 'Logs'}</button>
              <button type="button" onClick={() => { if (window.confirm('Rotate secret? Old secret stops working.')) rotate.mutate({ webhookId: w.id }); }} style={s.actBtn}>Rotate secret</button>
              <button type="button" onClick={() => { if (window.confirm('Delete this webhook?')) del.mutate({ webhookId: w.id }); }} style={s.delBtn}>Delete</button>
            </div>
            {tested === w.id && test.isSuccess && <p style={s.testMsg}>Test event queued — check your endpoint + the logs.</p>}
            {openLogs === w.id && <WebhookLogs webhookId={w.id} />}
          </section>
        ))
      )}
    </>
  );
}

function WebhookLogs({ webhookId }: { webhookId: string }) {
  const q = trpc.webhook.getWebhookLogs.useQuery({ webhookId, limit: 30 }, { refetchInterval: 5000 });
  const logs = q.data ?? [];
  if (q.isLoading) return <p style={s.muted}>Loading logs…</p>;
  if (logs.length === 0) return <p style={s.muted}>No deliveries yet.</p>;
  return (
    <div style={s.logTableWrap}>
      <table style={s.logTable}>
        <thead><tr><th style={s.th}>Event</th><th style={s.th}>Status</th><th style={s.th}>Retries</th><th style={s.th}>When</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} style={s.tr}>
              <td style={s.td}>{l.eventType}</td>
              <td style={{ ...s.td, color: l.succeededAt ? '#1d7a3a' : '#c0392b' }}>{l.succeededAt ? `✓ ${l.statusCode ?? 'ok'}` : `✗ ${l.statusCode ?? 'error'}`}</td>
              <td style={s.td}>{l.retries}</td>
              <td style={s.td}>{relativeTime(l.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { marginBottom: 4 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: 0, color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: '4px 0 0' },
  docLink: { color: TEAL, fontWeight: 600 },
  fresh: { background: '#eef6f5', border: `1px solid ${TEAL}`, borderRadius: 'var(--radius-card)', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 8 },
  freshLabel: { fontSize: 13, fontWeight: 700, color: '#1f6b70', margin: 0 },
  keyRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  keyCode: { flex: 1, minWidth: 0, fontSize: 13, background: '#fff', border: '1px solid #d6ebe9', borderRadius: 8, padding: '10px 12px', wordBreak: 'break-all' },
  copyBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  dismiss: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#6b6b66', fontSize: 13, cursor: 'pointer', padding: 0 },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 10 },
  h2: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  input: { border: '1px solid #e2e2da', borderRadius: 10, padding: '11px 14px', fontSize: 14, minHeight: 44 },
  eventGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 6 },
  evt: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3a3a34', minHeight: 36, cursor: 'pointer' },
  check: { width: 18, height: 18, accentColor: TEAL, cursor: 'pointer' },
  createBtn: { alignSelf: 'flex-start', background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  err: { color: '#c0392b', fontSize: 13, margin: 0 },
  muted: { color: '#8a8a83', fontSize: 14 },
  whHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  whUrl: { fontSize: 14, fontWeight: 700, color: '#1a1916', wordBreak: 'break-all' },
  whMeta: { fontSize: 12, color: '#8a8a83', marginTop: 2 },
  activeBtn: { color: '#fff', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
  secretDetails: { fontSize: 13 },
  secretSummary: { fontSize: 13, color: TEAL, cursor: 'pointer' },
  secretCode: { display: 'block', marginTop: 6, fontSize: 12, background: '#f4f4ef', borderRadius: 8, padding: '8px 10px', wordBreak: 'break-all' },
  whActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actBtn: { background: '#fff', color: '#55554f', border: '1px solid #e2e2da', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  delBtn: { background: '#fff', color: '#c0392b', border: '1px solid #f0d3cf', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  testMsg: { fontSize: 13, color: '#1d7a3a', margin: 0 },
  logTableWrap: { overflowX: 'auto', marginTop: 4 },
  logTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 380 },
  th: { textAlign: 'left', padding: '6px 8px', color: '#8a8a83', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #efefe9' },
  tr: { borderBottom: '1px solid #f4f4ef' },
  td: { padding: '8px', color: '#2a2a26' },
};
