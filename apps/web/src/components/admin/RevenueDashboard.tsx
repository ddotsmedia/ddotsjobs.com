'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

const RANGES = [{ d: 7, l: '7d' }, { d: 30, l: '30d' }, { d: 90, l: '90d' }, { d: 3650, l: 'All time' }];
const PLAN_COLOR: Record<string, string> = {
  employer_starter: '#3A9EA5', employer_growth: '#F5C842', hospital_pro: '#E8623A', agency: '#8DC63F', free: '#6B6860',
};
const planLabel = (t: string) => t.replace(/^employer_/, '').replace(/_/g, ' ');
function rupees(paise: number): string { return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`; }
function rupeesR(r: number): string { return `₹${r.toLocaleString('en-IN')}`; }

export function RevenueDashboard() {
  const [days, setDays] = useState(30);
  const [payStatus, setPayStatus] = useState<'all' | 'captured' | 'failed' | 'refunded'>('all');
  const [subStatus, setSubStatus] = useState<'all' | 'active' | 'expired' | 'cancelled'>('active');
  const [copied, setCopied] = useState('');

  const stats = trpc.admin.revenueStats.useQuery({ days });
  const timeline = trpc.admin.revenueTimeline.useQuery({ days });
  const byPlan = trpc.admin.revenueByPlan.useQuery();
  const payments = trpc.admin.getPayments.useQuery({ status: payStatus, limit: 20, offset: 0 });
  const subs = trpc.admin.getSubscriptions.useQuery({ status: subStatus, limit: 20, offset: 0 });
  const insights = trpc.admin.revenueInsights.useMutation();
  const utils = trpc.useUtils();
  const [exporting, setExporting] = useState(false);
  async function downloadCsv() {
    setExporting(true);
    try {
      const r = await utils.admin.exportPaymentsCSV.fetch();
      const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const st = stats.data;
  const tl = timeline.data ?? [];
  const maxRev = Math.max(...tl.map((t) => t.amountRupees), 1);
  const planRows = byPlan.data ?? [];
  const maxPlanRev = Math.max(...planRows.map((p) => p.revenueRupees), 1);

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div><h1 style={s.h1}>Revenue &amp; Subscriptions</h1><Link href="/admin/dashboard" style={s.back}>← Dashboard</Link></div>
          <div style={s.rangeRow}>
            {RANGES.map((r) => <button key={r.d} type="button" onClick={() => setDays(r.d)} style={{ ...s.rangeBtn, background: days === r.d ? '#3A9EA5' : 'rgba(255,255,255,0.08)', color: days === r.d ? '#fff' : 'rgba(255,255,255,0.6)' }}>{r.l}</button>)}
          </div>
        </header>

        {st && !st.razorpayConfigured && (
          <div style={s.amber}>⚠️ Razorpay not configured. Payment data is empty. Add RAZORPAY_KEY_ID to .env to enable payments.</div>
        )}

        {/* Section 1 — metrics */}
        <section style={s.metricsGrid}>
          <div style={s.metricCard}>
            <div style={s.metricValue}>{rupees(st?.revenuePeriodPaise ?? 0)}</div>
            <div style={s.metricLabel}>Revenue ({days >= 3650 ? 'all time' : `${days} days`})</div>
            {st?.changePct != null && <div style={{ ...s.metricSub, color: st.changePct >= 0 ? '#2ec27a' : '#E8623A' }}>{st.changePct >= 0 ? '↑' : '↓'} {Math.abs(st.changePct)}% vs previous</div>}
          </div>
          <div style={s.metricCard}>
            <div style={s.metricValue}>{rupees(st?.revenueTotalPaise ?? 0)}</div>
            <div style={s.metricLabel}>All time revenue</div>
            <div style={s.metricSub}>{st?.transactionsTotal ?? 0} transactions</div>
          </div>
          <div style={s.metricCard}>
            <div style={{ ...s.metricValue, color: '#3A9EA5' }}>{st?.activeSubs ?? 0}</div>
            <div style={s.metricLabel}>Active paid plans</div>
            <div style={s.metricSub}>{st?.starter ?? 0} starter · {st?.growth ?? 0} growth · {st?.pro ?? 0} pro · {st?.agency ?? 0} agency</div>
          </div>
          <div style={s.metricCard}>
            <div style={{ ...s.metricValue, color: '#3A9EA5' }}>{rupees(st?.gstTotalPaise ?? 0)}</div>
            <div style={s.metricLabel}>GST collected (18%)</div>
            <div style={s.metricSub}>Total all time</div>
          </div>
        </section>

        {/* Section 2 — revenue chart */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>Daily revenue (₹)</h2>
          {tl.length === 0 ? (
            <p style={s.muted}>No revenue data yet. Configure Razorpay to start accepting payments.</p>
          ) : (
            <div style={s.chart}>
              {tl.map((t, i) => (
                <div key={i} title={`${t.date}: ${rupeesR(t.amountRupees)} (${t.transactions} txn)`} style={{ ...s.bar, height: `${Math.max((t.amountRupees / maxRev) * 100, 2)}%` }} />
              ))}
            </div>
          )}
        </div>

        {/* Section 3 — plan breakdown */}
        <div style={s.two}>
          <div style={s.card}>
            <h2 style={s.cardTitle}>Revenue by plan</h2>
            {planRows.length === 0 ? <p style={s.muted}>No subscriptions yet.</p> : planRows.map((p) => (
              <div key={p.tier} style={s.planRow}>
                <div style={s.planTop}>
                  <span><span style={{ ...s.planDot, background: PLAN_COLOR[p.tier] ?? '#6B6860' }} /> {planLabel(p.tier)} · {p.subscriberCount}</span>
                  <span style={s.planRev}>{rupeesR(p.revenueRupees)}</span>
                </div>
                <div style={s.planTrack}><div style={{ ...s.planFill, width: `${Math.max((p.revenueRupees / maxPlanRev) * 100, 2)}%`, background: PLAN_COLOR[p.tier] ?? '#6B6860' }} /></div>
              </div>
            ))}
          </div>
          <div style={s.card}>
            <h2 style={s.cardTitle}>AI insights</h2>
            {insights.data?.insights.length ? (
              <ul style={s.insightList}>{insights.data.insights.map((x, i) => <li key={i} style={s.insight}>{x}</li>)}</ul>
            ) : (
              <p style={s.muted}>Generate revenue insights from current data.</p>
            )}
            <button type="button" onClick={() => insights.mutate({ days })} disabled={insights.isPending} style={s.aiBtn}>{insights.isPending ? 'Analyzing…' : '✨ Generate insights'}</button>
            <p style={s.aiLabel}>AI insights · Powered by Gemini</p>
          </div>
        </div>

        {/* Section 4 — subscriptions */}
        <div style={s.card}>
          <div style={s.tableHead}>
            <h2 style={s.cardTitle}>Subscriptions</h2>
            <button type="button" onClick={() => void downloadCsv()} disabled={exporting} style={s.exportBtn}>{exporting ? 'Exporting…' : 'Export CSV'}</button>
          </div>
          <div style={s.filterTabs}>
            {(['active', 'expired', 'cancelled', 'all'] as const).map((f) => <button key={f} type="button" onClick={() => setSubStatus(f)} style={{ ...s.fTab, color: subStatus === f ? '#fff' : 'rgba(255,255,255,0.45)', borderBottom: subStatus === f ? '2px solid #3A9EA5' : '2px solid transparent' }}>{f}</button>)}
          </div>
          {subs.isLoading ? <p style={s.muted}>Loading…</p> : (subs.data ?? []).length === 0 ? <p style={s.muted}>No subscriptions.</p> : (
            <div style={s.tableScroll}>
              <table style={s.table}>
                <thead><tr style={s.thr}><th style={s.th}>Company</th><th style={s.th}>Plan</th><th style={s.th}>District</th><th style={s.th}>Started</th><th style={s.th}>Renews</th><th style={s.th}>Amount</th><th style={s.th}>Status</th></tr></thead>
                <tbody>
                  {subs.data!.map((r) => {
                    const expSoon = r.currentPeriodEnd && new Date(r.currentPeriodEnd).getTime() - Date.now() < 7 * 86_400_000;
                    return (
                      <tr key={r.id} style={s.tr}>
                        <td style={s.td}>{r.companyName ?? '—'}</td>
                        <td style={s.td}><span style={{ ...s.badge, background: (PLAN_COLOR[r.tier] ?? '#6B6860') + '33', color: PLAN_COLOR[r.tier] ?? '#aaa' }}>{planLabel(r.tier)}</span></td>
                        <td style={s.td}>{r.district ?? '—'}</td>
                        <td style={s.td}>{r.currentPeriodStart ? new Date(r.currentPeriodStart).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={{ ...s.td, color: expSoon ? '#E8623A' : undefined }}>{r.currentPeriodEnd ? new Date(r.currentPeriodEnd).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={s.td}>{r.lastAmountPaise != null ? rupees(r.lastAmountPaise) : '—'}</td>
                        <td style={s.td}>{r.status === 'active' ? '✅ Active' : r.status === 'cancelled' ? '↩️ Cancelled' : '❌ ' + r.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 5 — payments */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>Payment transactions</h2>
          <div style={s.filterTabs}>
            {(['all', 'captured', 'failed', 'refunded'] as const).map((f) => <button key={f} type="button" onClick={() => setPayStatus(f)} style={{ ...s.fTab, color: payStatus === f ? '#fff' : 'rgba(255,255,255,0.45)', borderBottom: payStatus === f ? '2px solid #3A9EA5' : '2px solid transparent' }}>{f}</button>)}
          </div>
          {payments.isLoading ? <p style={s.muted}>Loading…</p> : (payments.data ?? []).length === 0 ? <p style={s.muted}>No transactions.</p> : (
            <div style={s.tableScroll}>
              <table style={s.table}>
                <thead><tr style={s.thr}><th style={s.th}>Date</th><th style={s.th}>Company</th><th style={s.th}>Plan</th><th style={s.th}>Amount</th><th style={s.th}>GST</th><th style={s.th}>Payment ID</th><th style={s.th}>Status</th></tr></thead>
                <tbody>
                  {payments.data!.map((r) => (
                    <tr key={r.id} style={s.tr}>
                      <td style={s.td}>{new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td style={s.td}>{r.companyName ?? '—'}</td>
                      <td style={s.td}>{r.tier ? <span style={{ ...s.badge, background: (PLAN_COLOR[r.tier] ?? '#6B6860') + '33', color: PLAN_COLOR[r.tier] ?? '#aaa' }}>{planLabel(r.tier)}</span> : '—'}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{rupees(r.amountPaise)}</td>
                      <td style={s.td}>{rupees(r.gstAmountPaise)}</td>
                      <td style={s.td}>
                        {r.razorpayPaymentId ? (
                          <button type="button" title="Click to copy" onClick={() => { void navigator.clipboard.writeText(r.razorpayPaymentId!); setCopied(r.id); }} style={s.payId}>
                            {copied === r.id ? 'copied ✓' : r.razorpayPaymentId.slice(0, 15)}
                          </button>
                        ) : '—'}
                      </td>
                      <td style={s.td}>{r.status === 'captured' ? '✅' : r.status === 'failed' ? '❌' : r.status === 'refunded' ? '↩️' : r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', padding: 'var(--space-3) var(--space-2)' },
  wrap: { maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 },
  back: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  rangeRow: { display: 'flex', gap: 6 },
  rangeBtn: { border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  amber: { background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.4)', color: '#F5C842', borderRadius: 10, padding: '12px 16px', fontSize: 14 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 },
  metricCard: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' },
  metricValue: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, color: '#F5C842', lineHeight: 1 },
  metricLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#3A9EA5', marginTop: 6 },
  metricSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  card: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 12px' },
  muted: { color: 'rgba(255,255,255,0.4)', padding: 8 },
  chart: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 },
  bar: { flex: 1, minWidth: 3, background: '#F5C842', borderRadius: '4px 4px 0 0' },
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'var(--space-2)' },
  planRow: { marginBottom: 12 },
  planTop: { display: 'flex', justifyContent: 'space-between', color: '#e8e8e2', fontSize: 13, textTransform: 'capitalize' },
  planDot: { display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6 },
  planRev: { color: '#fff', fontWeight: 700 },
  planTrack: { height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginTop: 6 },
  planFill: { height: '100%', borderRadius: 4 },
  insightList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  insight: { color: '#d8d8d2', fontSize: 13, lineHeight: 1.5 },
  aiBtn: { marginTop: 12, width: '100%', background: 'linear-gradient(135deg,#3A9EA5,#2E8A91)', color: '#fff', border: 'none', borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  aiLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8, textAlign: 'center' },
  tableHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  exportBtn: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' },
  filterTabs: { display: 'flex', gap: 4, marginBottom: 8 },
  fTab: { background: 'none', border: 'none', padding: '8px 12px', fontSize: 13, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer' },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thr: { color: 'rgba(255,255,255,0.4)', textAlign: 'left' },
  th: { padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' },
  tr: { borderTop: '1px solid rgba(255,255,255,0.06)', color: '#e8e8e2' },
  td: { padding: '10px 10px', whiteSpace: 'nowrap' },
  badge: { fontSize: 11, padding: '3px 8px', borderRadius: 999, textTransform: 'capitalize' },
  payId: { background: 'none', border: 'none', color: '#7fd4da', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, cursor: 'pointer', padding: 0 },
};
