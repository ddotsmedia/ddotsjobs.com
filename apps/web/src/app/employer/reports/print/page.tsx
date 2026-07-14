import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  db,
  computeFunnel,
  computeSources,
  computeStageMetrics,
  computeTimeToHire,
  fetchApplicationsForReport,
  fetchReferralApplies,
  resolveEmployerId,
} from '@ddotsjobs/db';
import { auth } from '@/lib/auth';
import { ReportPrintTrigger } from '@/components/employer/ReportPrintTrigger';

export const metadata: Metadata = { title: 'Report — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  hiring_funnel: 'Hiring Funnel',
  applicant_source: 'Applicant Source',
  time_to_hire: 'Time to Hire',
};

type SP = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ReportPrintPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/employer/reports');
  const empId = await resolveEmployerId(db, session.user.id);
  if (!empId) redirect('/employer/register');

  const type = one(sp.type) ?? 'hiring_funnel';
  const from = one(sp.from);
  const to = one(sp.to);
  const filters = { from, to, jobId: one(sp.jobId), category: one(sp.category) };
  const rows = await fetchApplicationsForReport(db, empId, filters);

  const funnel = computeFunnel(rows);
  const sources = computeSources(rows);
  const tth = computeTimeToHire(rows);
  const stages = computeStageMetrics(rows);
  const referral = type === 'applicant_source' ? await fetchReferralApplies(db, empId) : 0;

  const rangeLabel = from || to ? `${from ? from.slice(0, 10) : '…'} → ${to ? to.slice(0, 10) : 'today'}` : 'All time';

  return (
    <div style={s.page}>
      <style>{PRINT_CSS}</style>
      <ReportPrintTrigger />

      <header style={s.head}>
        <div style={s.brand}>ddotsjobs<span style={{ color: '#F5C842' }}>.</span></div>
        <h1 style={s.h1}>{TYPE_LABEL[type] ?? 'Analytics'} Report</h1>
        <div style={s.meta}>Range: {rangeLabel} · Generated {new Date().toISOString().slice(0, 10)}</div>
      </header>

      {type === 'hiring_funnel' && (
        <>
          <Kpis items={[['Total applied', funnel.total], ['Offers sent', funnel.offersSent], ['Hired', funnel.hired], ['Offer acceptance', funnel.offerAcceptanceRate === null ? '—' : `${funnel.offerAcceptanceRate}%`]]} />
          <Table
            headers={['Stage', 'Count', 'Conversion %', 'Drop-off %', 'Overall %']}
            rows={funnel.stages.map((st) => [st.label, st.count, `${st.conversionPct}%`, `${st.dropoffPct}%`, `${st.overallPct}%`])}
          />
        </>
      )}

      {type === 'applicant_source' && (
        <>
          <Kpis items={[['Total applies', sources.total], ['Referral-attributed', referral]]} />
          <Table
            headers={['Channel', 'Applies', 'Share %']}
            rows={sources.sources.map((sc) => [sc.label, sc.count, `${sources.total > 0 ? Math.round((sc.count / sources.total) * 1000) / 10 : 0}%`])}
          />
          <p style={s.note}>Per-channel offers/hires are not attributed — applications carry no per-source tag.</p>
        </>
      )}

      {type === 'time_to_hire' && (
        <>
          <Kpis items={[['Hires', tth.hiredCount], ['Avg days to hire', tth.avgDaysToHire ?? '—'], ['Median days', tth.medianDaysToHire ?? '—'], ['Avg from posting', tth.avgDaysFromPost ?? '—']]} />
          <Table headers={['Stage', 'Avg days in stage', 'Transitions']} rows={stages.map((st) => [st.label, st.avgDays ?? '—', st.n])} />
        </>
      )}

      <footer style={s.footer}>ddotsjobs.com · Confidential hiring analytics</footer>
    </div>
  );
}

function Kpis({ items }: { items: [string, string | number][] }) {
  return (
    <div style={s.kpis}>
      {items.map(([label, value]) => (
        <div key={label} style={s.kpi}>
          <div style={s.kpiValue}>{value}</div>
          <div style={s.kpiLabel}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table style={s.table}>
      <thead>
        <tr>{headers.map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} style={s.td}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

const PRINT_CSS = `@media print { .no-print { display: none !important; } body { background: #fff !important; } }`;

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', color: '#1a1916', background: '#fff' },
  head: { borderBottom: '2px solid #3A9EA5', paddingBottom: 12, marginBottom: 20 },
  brand: { fontSize: 22, fontWeight: 800, fontStyle: 'italic', color: '#3A9EA5' },
  h1: { fontSize: 26, margin: '8px 0 4px' },
  meta: { fontSize: 13, color: '#6b6b66' },
  kpis: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 },
  kpi: { flex: '1 1 120px', border: '1px solid #efefe9', borderRadius: 10, padding: 12 },
  kpiValue: { fontSize: 24, fontWeight: 800, color: '#0F1A1B' },
  kpiLabel: { fontSize: 12, color: '#8a8a83', marginTop: 2 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 },
  th: { textAlign: 'left', padding: '8px 10px', background: '#f4f4ef', borderBottom: '2px solid #e2e2da', fontSize: 12, textTransform: 'uppercase', color: '#55554f' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f0f0ea' },
  note: { fontSize: 12, color: '#8a8a83' },
  footer: { marginTop: 24, paddingTop: 12, borderTop: '1px solid #efefe9', fontSize: 11, color: '#9a9a92', textAlign: 'center' },
};
