'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { PROVIDERS, providerMeta, type ProviderName } from '@/lib/integration-providers';

const TEAL = '#3A9EA5';
const EVENT_LABELS: Record<string, string> = {
  job_posted: 'Job posted',
  application_received: 'Application received',
  offer_sent: 'Offer sent',
};
const ALL_EVENTS = ['job_posted', 'application_received', 'offer_sent'] as const;

type IntegrationRow = {
  id: string;
  providerName: string;
  isConnected: boolean;
  meta: Record<string, unknown>;
  lastError: string | null;
  lastSyncedAt: Date | null;
  events: { eventType: string; enabled: boolean }[];
};

export function IntegrationsManager() {
  const utils = trpc.useUtils();
  const q = trpc.integrations.getIntegrations.useQuery();
  const rows = (q.data ?? []) as IntegrationRow[];
  const byProvider = new Map(rows.map((r) => [r.providerName, r]));

  return (
    <>
      <header style={s.head}>
        <div>
          <p style={s.eyebrow}>Employer</p>
          <h1 style={s.h1}>Integrations</h1>
          <p style={s.sub}>Connect ddotsjobs to the tools your team already uses.</p>
        </div>
      </header>

      {q.isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : (
        <div style={s.grid}>
          {PROVIDERS.map((p) => (
            <ProviderCard key={p.name} provider={p.name} connected={byProvider.get(p.name)} onChanged={() => void utils.integrations.getIntegrations.invalidate()} />
          ))}
        </div>
      )}
    </>
  );
}

function ProviderCard({ provider, connected, onChanged }: { provider: ProviderName; connected?: IntegrationRow; onChanged: () => void }) {
  const meta = providerMeta(provider)!;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const connect = trpc.integrations.connectIntegration.useMutation({ onSuccess: () => { setOpen(false); setForm({}); onChanged(); }, onError: (e) => setErr(e.message) });
  const disconnect = trpc.integrations.disconnectIntegration.useMutation({ onSuccess: onChanged });
  const toggle = trpc.integrations.toggleIntegrationEvent.useMutation({ onSuccess: onChanged });
  const test = trpc.integrations.testIntegration.useMutation();

  const submit = () => {
    setErr(null);
    connect.mutate({ providerName: provider, config: form });
  };

  const eventEnabled = (e: string) => connected?.events.find((x) => x.eventType === e)?.enabled ?? true;

  return (
    <section style={{ ...s.card, ...(connected?.isConnected ? s.cardOn : {}) }}>
      <div style={s.cardHead}>
        <div>
          <div style={s.provName}>{meta.label}{connected?.isConnected && <span style={s.dot} />}</div>
          <div style={s.blurb}>{meta.blurb}</div>
        </div>
        {connected?.isConnected && <span style={s.connectedTag}>Connected</span>}
      </div>

      {connected?.lastError && <div style={s.errorBox}>Last push failed: {connected.lastError}</div>}
      {connected?.meta && Object.keys(connected.meta).length > 0 && (
        <div style={s.metaHint}>{Object.entries(connected.meta).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</div>
      )}

      {connected?.isConnected ? (
        <>
          <div style={s.events}>
            <div style={s.eventsLabel}>Push events</div>
            {ALL_EVENTS.map((e) => (
              <label key={e} style={s.eventRow}>
                <input type="checkbox" checked={eventEnabled(e)} onChange={(ev) => toggle.mutate({ integrationId: connected.id, eventType: e, enabled: ev.target.checked })} style={s.check} />
                {EVENT_LABELS[e]}
              </label>
            ))}
          </div>
          <div style={s.actions}>
            <button type="button" onClick={() => test.mutate({ integrationId: connected.id })} style={s.actBtn}>{test.isPending ? 'Sending…' : 'Send test'}</button>
            <button type="button" onClick={() => { if (window.confirm(`Disconnect ${meta.label}?`)) disconnect.mutate({ integrationId: connected.id }); }} style={s.disconnectBtn}>Disconnect</button>
          </div>
          {test.isSuccess && <p style={s.testMsg}>Test queued — check {meta.label} and the events status.</p>}
        </>
      ) : meta.comingSoon ? (
        <div style={s.soon}>Coming soon</div>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} style={s.connectBtn}>Connect {meta.label}</button>
      ) : (
        <div style={s.form}>
          {meta.fields.map((f) => (
            <label key={f.key} style={s.field}>
              <span style={s.fieldLabel}>{f.label}</span>
              <input
                type={f.secret ? 'password' : 'text'}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={s.input}
                autoComplete="off"
              />
            </label>
          ))}
          {meta.helpUrl && <a href={meta.helpUrl} target="_blank" rel="noreferrer" style={s.help}>Where do I find this? →</a>}
          {err && <p style={s.err}>{err}</p>}
          <div style={s.actions}>
            <button type="button" onClick={submit} disabled={connect.isPending} style={s.connectBtn}>{connect.isPending ? 'Connecting…' : 'Connect'}</button>
            <button type="button" onClick={() => { setOpen(false); setErr(null); }} style={s.cancelBtn}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { marginBottom: 4 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEAL, margin: 0 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: '2px 0 0', color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: '4px 0 0' },
  muted: { color: '#8a8a83', fontSize: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'var(--space-2)' },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 10 },
  cardOn: { borderColor: '#c9e6e3' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  provName: { fontSize: 15, fontWeight: 800, color: '#1a1916', display: 'flex', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#1d7a3a', display: 'inline-block' },
  blurb: { fontSize: 12.5, color: '#8a8a83', marginTop: 2 },
  connectedTag: { fontSize: 11, fontWeight: 700, color: '#1d7a3a', background: '#e6f5ea', borderRadius: 999, padding: '3px 10px', flexShrink: 0 },
  errorBox: { fontSize: 12, color: '#c0392b', background: '#fdecea', borderRadius: 8, padding: '8px 10px' },
  metaHint: { fontSize: 12, color: '#6b6b66' },
  events: { display: 'flex', flexDirection: 'column', gap: 6 },
  eventsLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8a8a83' },
  eventRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3a3a34', minHeight: 32, cursor: 'pointer' },
  check: { width: 18, height: 18, accentColor: TEAL, cursor: 'pointer' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actBtn: { background: '#fff', color: '#55554f', border: '1px solid #e2e2da', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  disconnectBtn: { background: '#fff', color: '#c0392b', border: '1px solid #f0d3cf', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  connectBtn: { alignSelf: 'flex-start', background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 42 },
  cancelBtn: { background: 'none', color: '#8a8a83', border: 'none', fontSize: 13, cursor: 'pointer' },
  soon: { alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: '#9a6b00', background: '#fdf3da', borderRadius: 999, padding: '6px 14px' },
  testMsg: { fontSize: 12.5, color: '#1d7a3a', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 12.5, fontWeight: 600, color: '#3a3a34' },
  input: { border: '1px solid #e2e2da', borderRadius: 10, padding: '10px 12px', fontSize: 14, minHeight: 42 },
  help: { fontSize: 12, color: TEAL, fontWeight: 600 },
  err: { fontSize: 12.5, color: '#c0392b', margin: 0 },
};
