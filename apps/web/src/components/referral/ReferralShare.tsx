'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

// "Share & earn" card on job detail — authenticated seekers only.
export function ReferralShare({ jobId }: { jobId: string }) {
  const gen = trpc.referral.generateReferralLink.useMutation();
  const [copied, setCopied] = useState(false);
  const url = gen.data?.url;

  return (
    <div style={s.card}>
      <div style={s.title}>💸 Share &amp; earn credits</div>
      <p style={s.sub}>Earn points when people apply through your link — redeem for premium.</p>
      {!url ? (
        <button type="button" onClick={() => gen.mutate({ jobId })} disabled={gen.isPending} style={s.gen}>
          {gen.isPending ? 'Generating…' : 'Get my referral link'}
        </button>
      ) : (
        <>
          <div style={s.linkRow}>
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={s.input} />
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); }} style={s.copy}>{copied ? '✓' : 'Copy'}</button>
          </div>
          <div style={s.shareRow}>
            <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" style={{ ...s.shareBtn, ...s.wa }}>WhatsApp</a>
            <a href={`mailto:?subject=${encodeURIComponent('A job on ddotsjobs')}&body=${encodeURIComponent(url)}`} style={{ ...s.shareBtn, ...s.mail }}>Email</a>
          </div>
        </>
      )}
      <Link href="/seeker/referrals" style={s.dash}>View my referrals →</Link>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: '#fff', border: '1px solid #efefe9', borderRadius: 'var(--radius-card)', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: 0 },
  gen: { minHeight: 44, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  linkRow: { display: 'flex', gap: 6 },
  input: { flex: 1, minWidth: 0, border: '1px solid #e2e2da', borderRadius: 8, padding: '9px 10px', fontSize: 12, color: '#55554f' },
  copy: { flex: '0 0 auto', minHeight: 40, padding: '0 16px', border: '1px solid var(--color-accent)', background: '#fff', color: 'var(--color-accent)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  shareRow: { display: 'flex', gap: 8 },
  shareBtn: { flex: 1, textAlign: 'center', minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700 },
  wa: { background: '#25D366', color: '#fff' },
  mail: { background: '#f1f1ec', color: '#55554f' },
  dash: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)', marginTop: 2 },
};
