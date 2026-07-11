'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { formatDate } from '@/lib/format';

const TEAL = '#3A9EA5';

export function ApiKeysManager() {
  const utils = trpc.useUtils();
  const q = trpc.apiKeys.listApiKeys.useQuery();
  const [label, setLabel] = useState('');
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = trpc.apiKeys.generateApiKey.useMutation({
    onSuccess: (r) => { setFreshKey(r.key); setLabel(''); setCopied(false); void utils.apiKeys.listApiKeys.invalidate(); },
  });
  const revoke = trpc.apiKeys.revokeApiKey.useMutation({ onSuccess: () => void utils.apiKeys.listApiKeys.invalidate() });

  const rows = q.data ?? [];

  return (
    <>
      <header style={s.head}>
        <div>
          <h1 style={s.h1}>API keys</h1>
          <p style={s.sub}>Post jobs programmatically. <Link href="/docs/api" style={s.docLink}>Read the API docs →</Link></p>
        </div>
      </header>

      {freshKey && (
        <div style={s.fresh}>
          <p style={s.freshLabel}>New key — copy it now, it won’t be shown again:</p>
          <div style={s.keyRow}>
            <code style={s.keyCode}>{freshKey}</code>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(freshKey); setCopied(true); }} style={s.copyBtn}>{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
          <button type="button" onClick={() => setFreshKey(null)} style={s.dismiss}>Dismiss</button>
        </div>
      )}

      <section style={s.card}>
        <h2 style={s.h2}>Create a key</h2>
        <div style={s.createRow}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. ATS integration)" maxLength={100} style={s.input} />
          <button type="button" onClick={() => generate.mutate({ label: label.trim() || undefined })} disabled={generate.isPending} style={s.genBtn}>
            {generate.isPending ? 'Generating…' : 'Generate key'}
          </button>
        </div>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Your keys</h2>
        {q.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={s.muted}>No keys yet.</p>
        ) : (
          <div style={s.list}>
            {rows.map((k) => (
              <div key={k.id} style={s.keyItem}>
                <div style={{ minWidth: 0 }}>
                  <div style={s.keyLabel}>{k.label ?? 'Unnamed key'} {k.revokedAt && <span style={s.revoked}>· revoked</span>}</div>
                  <div style={s.keyMeta}><code style={s.mask}>{k.prefix}…</code> · created {formatDate(k.createdAt as unknown as string)}{k.lastUsedAt ? ` · last used ${formatDate(k.lastUsedAt as unknown as string)}` : ' · never used'}</div>
                </div>
                {!k.revokedAt && (
                  <button type="button" onClick={() => { if (window.confirm('Revoke this key? Apps using it will stop working.')) revoke.mutate({ keyId: k.id }); }} style={s.revokeBtn}>Revoke</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
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
  keyCode: { flex: 1, minWidth: 0, fontSize: 13, background: '#fff', border: '1px solid #d6ebe9', borderRadius: 8, padding: '10px 12px', wordBreak: 'break-all', color: '#1a1916' },
  copyBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  dismiss: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#6b6b66', fontSize: 13, cursor: 'pointer', padding: 0 },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 12 },
  h2: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  createRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { flex: '1 1 200px', minWidth: 0, border: '1px solid #e2e2da', borderRadius: 10, padding: '11px 14px', fontSize: 14, minHeight: 44 },
  genBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  muted: { color: '#8a8a83', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  keyItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f4f4ef' },
  keyLabel: { fontSize: 14, fontWeight: 700, color: '#2a2a26' },
  revoked: { color: '#c0392b', fontWeight: 400, fontSize: 12 },
  keyMeta: { fontSize: 12, color: '#8a8a83', marginTop: 2 },
  mask: { color: '#55554f' },
  revokeBtn: { background: '#fff', color: '#c0392b', border: '1px solid #f0d3cf', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
};
