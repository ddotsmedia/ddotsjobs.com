'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { PAID_TIERS, RECOMMENDED_TIER, type PaidTier } from '@/lib/plans';

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (r: RazorpayResponse) => void;
  theme?: { color?: string };
}
declare global {
  interface Window {
    Razorpay?: new (opts: RazorpayOptions) => { open: () => void };
  }
}

function rupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}
function jobsLabel(n: number | null | undefined): string {
  if (n == null) return '—';
  return n >= 999 ? 'Unlimited' : String(n);
}
function tierName(tier: string, plans: { tier: string; name: string }[]): string {
  return plans.find((p) => p.tier === tier)?.name ?? (tier === 'free' ? 'Free' : tier);
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function BillingClient() {
  const utils = trpc.useUtils();
  const plans = trpc.billing.plans.useQuery();
  const sub = trpc.billing.mySubscription.useQuery();
  const history = trpc.billing.history.useQuery();
  const createOrder = trpc.billing.createOrder.useMutation();
  const verifyPayment = trpc.billing.verifyPayment.useMutation();
  const cancel = trpc.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      void utils.billing.mySubscription.invalidate();
    },
  });
  const [busyTier, setBusyTier] = useState<PaidTier | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const planList = plans.data ?? [];
  const paidPlans = planList.filter((p): p is typeof p & { tier: PaidTier } => PAID_TIERS.includes(p.tier as PaidTier));
  const currentTier = sub.data?.tier ?? 'free';

  async function upgrade(tier: PaidTier) {
    setBusyTier(tier);
    try {
      const order = await createOrder.mutateAsync({ tier });
      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) {
        setToast('Could not load the payment gateway. Try again.');
        return;
      }
      const planName = tierName(tier, planList);
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'ddotsjobs.com',
        description: planName,
        theme: { color: '#f5a800' },
        handler: (resp) => {
          verifyPayment.mutate(
            { orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature, tier },
            {
              onSuccess: () => {
                setToast(`${planName} plan activated.`);
                void utils.billing.mySubscription.invalidate();
                void utils.billing.history.invalidate();
              },
              onError: (e) => setToast(e.message),
            },
          );
        },
      });
      rzp.open();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not start checkout.');
    } finally {
      setBusyTier(null);
    }
  }

  return (
    <>
      {toast && <div style={s.toast} onClick={() => setToast(null)}>{toast}</div>}

      {/* Current plan */}
      <section style={s.currentCard}>
        <div style={s.currentTop}>
          <div>
            <p style={s.currentLabel}>Current plan</p>
            <p style={s.currentName}>{tierName(currentTier, planList)} <span style={s.tierBadge}>{currentTier}</span></p>
          </div>
          {sub.data && (
            <div style={s.usageBox}>
              <span style={s.usageNum}>{sub.data.jobsPosted} / {jobsLabel(sub.data.jobsLimit)}</span>
              <span style={s.usageLabel}>jobs used this period</span>
            </div>
          )}
        </div>
        {sub.data?.active && sub.data.currentPeriodEnd && (
          <p style={s.renewal}>Renews {new Date(sub.data.currentPeriodEnd).toLocaleDateString('en-IN')}</p>
        )}
        {currentTier !== 'free' && (
          <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} style={s.cancelBtn}>
            {cancel.isPending ? 'Cancelling…' : 'Cancel subscription'}
          </button>
        )}
      </section>

      {/* Plan comparison */}
      <div style={s.planGrid}>
        {paidPlans.map((p) => {
          const isCurrent = p.tier === currentTier;
          const recommended = p.tier === RECOMMENDED_TIER;
          return (
            <article key={p.tier} style={{ ...s.planCard, ...(recommended ? s.planCardRec : {}) }}>
              {recommended && <span style={s.recBadge}>Recommended</span>}
              <h3 style={s.planName}>{p.name}</h3>
              <p style={s.planPrice}>{rupees(p.pricePaise)}<span style={s.perMo}>/mo</span></p>
              <p style={s.gst}>+ 18% GST</p>
              <ul style={s.featureList}>
                <li style={s.feature}>✓ {jobsLabel(p.jobsPerPeriod)} job posts</li>
                <li style={p.talentPoolAccess ? s.feature : s.featureOff}>{p.talentPoolAccess ? '✓' : '✕'} Talent pool</li>
                <li style={p.knmcFilterAccess ? s.feature : s.featureOff}>{p.knmcFilterAccess ? '✓' : '✕'} KNMC filter</li>
                <li style={s.feature}>✓ {p.whatsappPushPerMonth.toLocaleString('en-IN')} WhatsApp pushes/mo</li>
                <li style={s.feature}>✓ {jobsLabel(p.walkInNoticesPerMonth)} walk-in notices/mo</li>
              </ul>
              {isCurrent ? (
                <span style={s.currentBadge}>Current plan</span>
              ) : (
                <button type="button" onClick={() => upgrade(p.tier)} disabled={busyTier === p.tier} style={s.upgradeBtn}>
                  {busyTier === p.tier ? 'Opening…' : 'Upgrade'}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {/* Payment history */}
      <h2 style={s.h2}>Payment history</h2>
      <div style={s.historyCard}>
        {(history.data ?? []).length === 0 ? (
          <p style={{ color: '#6b6b66', margin: 0 }}>No payments yet.</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr style={{ color: '#6b6b66' }}>
                <th style={s.th}>Amount</th>
                <th style={s.th}>GST</th>
                <th style={s.th}>Plan</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.data!.map((h) => (
                <tr key={h.id} style={{ borderTop: '1px solid #f1f1ec' }}>
                  <td style={s.td}>{rupees(h.amountPaise)}</td>
                  <td style={s.td}>{rupees(h.gstAmountPaise)}</td>
                  <td style={s.td}>{h.tier ? tierName(h.tier, planList) : '—'}</td>
                  <td style={s.td}>{new Date(h.paidAt ?? h.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={s.td}><span style={s.paidBadge}>{h.status === 'captured' ? 'Paid' : h.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  toast: { padding: 'var(--space-2)', background: '#0f0e0c', color: '#fff', borderRadius: 'var(--radius-card)', fontSize: 14, cursor: 'pointer' },
  currentCard: { display: 'flex', flexDirection: 'column', gap: 8, padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  currentTop: { display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-start' },
  currentLabel: { fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#9a9a92', margin: 0 },
  currentName: { fontSize: '1.4rem', fontWeight: 700, margin: '4px 0 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  tierBadge: { fontSize: 11, fontWeight: 700, color: '#55554f', background: '#f1f1ec', padding: '2px 8px', borderRadius: 'var(--radius-pill)' },
  usageBox: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  usageNum: { fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-dark)' },
  usageLabel: { fontSize: 12, color: '#6b6b66' },
  renewal: { fontSize: 13, color: '#55554f', margin: 0 },
  cancelBtn: { alignSelf: 'flex-start', marginTop: 4, fontSize: 13, fontWeight: 600, color: '#c0392b', background: 'none', border: '1px solid #f0c9c4', borderRadius: 'var(--radius-pill)', padding: '8px 16px', cursor: 'pointer' },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-2)' },
  planCard: { position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-3) var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  planCardRec: { border: '2px solid var(--color-brand)', boxShadow: '0 4px 20px rgba(245,168,0,0.15)' },
  recBadge: { position: 'absolute', top: -10, left: 'var(--space-2)', fontSize: 11, fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  planName: { fontSize: '1.1rem', fontWeight: 700, margin: 0 },
  planPrice: { fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--color-dark)' },
  perMo: { fontSize: 14, fontWeight: 500, color: '#6b6b66' },
  gst: { fontSize: 12, color: '#9a9a92', margin: '0 0 6px' },
  featureList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  feature: { fontSize: 13, color: '#33332f' },
  featureOff: { fontSize: 13, color: '#b8b8b0' },
  currentBadge: { textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', background: '#e6f4f3', padding: '10px', borderRadius: 'var(--radius-pill)', marginTop: 6 },
  upgradeBtn: { marginTop: 6, minHeight: 44, fontSize: 14, fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.4rem', margin: 'var(--space-2) 0 0' },
  historyCard: { padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', fontSize: 12, fontWeight: 600, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.4 },
  td: { padding: '10px 8px' },
  paidBadge: { fontSize: 12, fontWeight: 700, color: '#1d7a3a', background: '#e6f5ea', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
};
