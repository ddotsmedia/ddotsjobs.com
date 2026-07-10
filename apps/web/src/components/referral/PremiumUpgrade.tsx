'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { formatDate } from '@/lib/format';

const BENEFITS = [
  'Priority placement in employer talent searches',
  'Unlimited Quick Apply',
  'Premium badge on your profile',
  'Early access to new walk-in drives',
  'Detailed fit-score breakdowns',
];

export function PremiumUpgrade({ authed }: { authed: boolean }) {
  const utils = trpc.useUtils();
  const status = trpc.referral.getPremiumStatus.useQuery(undefined, { enabled: authed });
  const bal = trpc.referral.getCreditBalance.useQuery(undefined, { enabled: authed });
  const redeem = trpc.referral.redeemCredits.useMutation({
    onSuccess: () => {
      void utils.referral.getPremiumStatus.invalidate();
      void utils.referral.getCreditBalance.invalidate();
    },
  });
  const [err, setErr] = useState<string | null>(null);

  const cost = status.data?.premiumCost ?? 500;
  const balance = bal.data?.balance ?? 0;
  const active = status.data?.active ?? false;

  const onUpgrade = () => {
    setErr(null);
    redeem.mutate({ redemptionType: 'premium_month' }, { onError: (e) => setErr(e.message) });
  };

  return (
    <div style={s.wrap}>
      <span style={s.kicker}>ddotsjobs Premium</span>
      <h1 style={s.h1}>Go further, faster</h1>
      <p style={s.sub}>Upgrade with the credits you earn from referrals — no card needed.</p>

      <ul style={s.benefits}>
        {BENEFITS.map((b) => (
          <li key={b} style={s.benefit}><span style={s.check}>✓</span>{b}</li>
        ))}
      </ul>

      <div style={s.card}>
        {!authed ? (
          <>
            <p style={s.cardText}>Sign in to upgrade with your referral credits.</p>
            <Link href="/login?redirect=/premium" style={s.primaryBtn}>Sign in</Link>
          </>
        ) : active ? (
          <>
            <div style={s.activeBadge}>★ Premium active</div>
            <p style={s.cardText}>Your premium is active{status.data?.premiumUntil ? ` until ${formatDate(status.data.premiumUntil as unknown as string)}` : ''}. Redeem more credits to extend it.</p>
            <button type="button" onClick={onUpgrade} disabled={balance < cost || redeem.isPending} style={{ ...s.primaryBtn, ...(balance < cost ? s.disabled : {}) }}>
              {redeem.isPending ? 'Extending…' : `Extend 1 month · ${cost} credits`}
            </button>
          </>
        ) : (
          <>
            <div style={s.priceRow}><span style={s.price}>{cost}</span><span style={s.priceUnit}>credits / month</span></div>
            <p style={s.cardText}>You have <strong>{balance}</strong> credits.</p>
            {balance >= cost ? (
              <button type="button" onClick={onUpgrade} disabled={redeem.isPending} style={s.primaryBtn}>
                {redeem.isPending ? 'Upgrading…' : 'Upgrade with credits'}
              </button>
            ) : (
              <Link href="/seeker/referrals" style={s.primaryBtn}>Earn {cost - balance} more credits →</Link>
            )}
          </>
        )}
        {err && <p style={s.err}>{err}</p>}
        <p style={s.note}>Card payments coming soon.</p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', maxWidth: 640, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  kicker: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.9rem,6vw,2.6rem)', margin: 0, color: 'var(--color-dark)' },
  sub: { fontSize: 15, color: '#6b6b66', margin: '4px 0 var(--space-2)' },
  benefits: { listStyle: 'none', margin: '0 0 var(--space-2)', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  benefit: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 15, color: '#2a2a26' },
  check: { width: 24, height: 24, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#1d7a3a', borderRadius: '50%', fontSize: 13, fontWeight: 700 },
  card: { background: '#fff', border: '1px solid #efefe9', borderRadius: 'var(--radius-card)', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' },
  cardText: { fontSize: 14, color: '#55554f', margin: 0 },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: 8 },
  price: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 44, color: 'var(--color-accent)', lineHeight: 1 },
  priceUnit: { fontSize: 14, color: '#6b6b66' },
  activeBadge: { fontSize: 14, fontWeight: 700, color: '#8a5a12', background: '#fdf3da', padding: '4px 12px', borderRadius: 'var(--radius-pill)' },
  primaryBtn: { minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 28px', background: 'var(--color-brand)', color: '#0f0e0c', borderRadius: 'var(--radius-pill)', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  err: { color: '#c0392b', fontSize: 13, margin: 0 },
  note: { fontSize: 12, color: '#9a9a92', margin: 0 },
};
