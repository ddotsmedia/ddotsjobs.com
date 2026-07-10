'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { formatDate } from '@/lib/format';

const TEAL = '#3A9EA5';

const TXN_LABEL: Record<string, string> = { apply: 'Referral apply', hire: 'Referral hire', redeem: 'Redeemed', adjust: 'Adjustment' };

export function ReferralDashboard() {
  const utils = trpc.useUtils();
  const bal = trpc.referral.getCreditBalance.useQuery();
  const links = trpc.referral.getReferralLinks.useQuery();
  const history = trpc.referral.getCreditHistory.useQuery();
  const premium = trpc.referral.getPremiumStatus.useQuery();
  const gen = trpc.referral.generateReferralLink.useMutation({ onSuccess: () => void links.refetch() });
  const redeem = trpc.referral.redeemCredits.useMutation({
    onSuccess: () => {
      void utils.referral.getCreditBalance.invalidate();
      void utils.referral.getCreditHistory.invalidate();
      void utils.referral.getPremiumStatus.invalidate();
    },
  });

  const [copied, setCopied] = useState<string | null>(null);
  const balance = bal.data?.balance ?? 0;
  const cost = premium.data?.premiumCost ?? 500;
  const genericLink = gen.data?.code ? `${typeof window !== 'undefined' ? window.location.origin : 'https://ddotsjobs.com'}/jobs?ref=${gen.data.code}` : null;

  const copy = (text: string) => { void navigator.clipboard?.writeText(text); setCopied(text); };

  const onRedeem = () => {
    if (balance < cost) return;
    if (!window.confirm(`Redeem ${cost} credits for 1 month of premium?`)) return;
    redeem.mutate({ redemptionType: 'premium_month' });
  };

  return (
    <>
      <header style={s.head}>
        <div>
          <h1 style={s.h1}>Referrals</h1>
          <p style={s.sub}>Share jobs, earn credits, redeem for premium.</p>
        </div>
      </header>

      {/* Balance + redeem */}
      <section style={s.balanceCard}>
        <div>
          <div style={s.balanceNum}>{balance.toLocaleString('en-IN')}</div>
          <div style={s.balanceLabel}>credits available</div>
        </div>
        <div style={s.balanceRight}>
          {premium.data?.active ? (
            <span style={s.premiumBadge}>★ Premium until {premium.data.premiumUntil ? formatDate(premium.data.premiumUntil as unknown as string) : ''}</span>
          ) : null}
          <button type="button" onClick={onRedeem} disabled={balance < cost || redeem.isPending} style={{ ...s.redeemBtn, ...(balance < cost ? s.redeemDisabled : {}) }}>
            {redeem.isPending ? 'Redeeming…' : `Redeem ${cost} → 1 month premium`}
          </button>
          {balance < cost && <span style={s.needMore}>Earn {cost - balance} more to redeem</span>}
        </div>
      </section>

      {/* How it works */}
      <section style={s.card}>
        <h2 style={s.h2}>How it works</h2>
        <ol style={s.steps}>
          <li><strong>Share</strong> a job with your referral link (from any job page).</li>
          <li>When someone <strong>applies</strong> through your link, you earn <strong>10 credits</strong>.</li>
          <li><strong>Redeem</strong> {cost} credits for 1 month of premium.</li>
        </ol>
        <div style={s.genRow}>
          <button type="button" onClick={() => gen.mutate({})} disabled={gen.isPending} style={s.genBtn}>
            {gen.isPending ? 'Generating…' : 'Get my general referral link'}
          </button>
          {genericLink && (
            <div style={s.linkRow}>
              <input readOnly value={genericLink} onFocus={(e) => e.currentTarget.select()} style={s.input} />
              <button type="button" onClick={() => copy(genericLink)} style={s.copyBtn}>{copied === genericLink ? '✓' : 'Copy'}</button>
            </div>
          )}
        </div>
      </section>

      {/* Links */}
      <section style={s.card}>
        <h2 style={s.h2}>Your referral links</h2>
        {links.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : (links.data?.length ?? 0) === 0 ? (
          <p style={s.muted}>No links yet. Open a job and tap “Share &amp; earn”, or generate a general link above.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Link</th><th style={{ ...s.th, ...s.right }}>Clicks</th><th style={{ ...s.th, ...s.right }}>Applies</th></tr></thead>
              <tbody>
                {links.data!.map((l) => (
                  <tr key={l.id} style={s.tr}>
                    <td style={s.td}>{l.jobTitle ?? 'General link'} <span style={s.code}>· {l.code}</span></td>
                    <td style={{ ...s.td, ...s.right }}>{l.clicks}</td>
                    <td style={{ ...s.td, ...s.right }}>{l.applies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* History */}
      <section style={s.card}>
        <h2 style={s.h2}>Credit history</h2>
        {history.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : (history.data?.length ?? 0) === 0 ? (
          <p style={s.muted}>No transactions yet.</p>
        ) : (
          <div style={s.list}>
            {history.data!.map((h) => (
              <div key={h.id} style={s.txn}>
                <div>
                  <div style={s.txnType}>{TXN_LABEL[h.transactionType] ?? h.transactionType}</div>
                  <div style={s.txnDate}>{formatDate(h.createdAt as unknown as string)}</div>
                </div>
                <span style={{ ...s.txnAmt, color: h.amount >= 0 ? '#1d7a3a' : '#c0392b' }}>{h.amount >= 0 ? '+' : ''}{h.amount}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Link href="/premium" style={s.premiumLink}>Learn about premium →</Link>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { marginBottom: 4 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: 0, color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: '4px 0 0' },
  balanceCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, background: '#0F1A1B', color: '#fff', borderRadius: 'var(--radius-card)', padding: 'var(--space-3)' },
  balanceNum: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 52, lineHeight: 1, color: '#F5C842' },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  balanceRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  premiumBadge: { fontSize: 12, fontWeight: 700, color: '#F5C842' },
  redeemBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  redeemDisabled: { background: 'rgba(255,255,255,0.15)', cursor: 'not-allowed' },
  needMore: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)' },
  h2: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', margin: '0 0 12px' },
  steps: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#3a3a34' },
  genRow: { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  genBtn: { alignSelf: 'flex-start', background: '#fff', color: TEAL, border: `1px solid ${TEAL}`, borderRadius: 'var(--radius-pill)', padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  linkRow: { display: 'flex', gap: 6 },
  input: { flex: 1, minWidth: 0, border: '1px solid #e2e2da', borderRadius: 8, padding: '9px 10px', fontSize: 12, color: '#55554f' },
  copyBtn: { flex: '0 0 auto', minHeight: 40, padding: '0 16px', border: `1px solid ${TEAL}`, background: '#fff', color: TEAL, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  muted: { color: '#8a8a83', fontSize: 14 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 360 },
  th: { textAlign: 'left', padding: '8px 10px', color: '#8a8a83', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #efefe9' },
  tr: { borderBottom: '1px solid #f4f4ef' },
  td: { padding: '10px', color: '#2a2a26' },
  right: { textAlign: 'right' },
  code: { color: '#9a9a92', fontSize: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 2 },
  txn: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #f4f4ef' },
  txnType: { fontSize: 14, fontWeight: 600, color: '#2a2a26' },
  txnDate: { fontSize: 12, color: '#9a9a92' },
  txnAmt: { fontSize: 15, fontWeight: 700 },
  premiumLink: { fontSize: 14, fontWeight: 600, color: TEAL },
};
