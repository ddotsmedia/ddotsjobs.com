import type { computeFunnel, computeSources, computeStageMetrics, computeTimeToHire } from '@ddotsjobs/db';

type Cell = string | number | null;

function csvEscape(v: Cell): string {
  const s = v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

export function funnelCsv(f: ReturnType<typeof computeFunnel>): string {
  const rows: Cell[][] = [['Stage', 'Count', 'Conversion %', 'Drop-off %', 'Overall %']];
  for (const s of f.stages) rows.push([s.label, s.count, `${s.conversionPct}%`, `${s.dropoffPct}%`, `${s.overallPct}%`]);
  rows.push([]);
  rows.push(['Offers sent', f.offersSent]);
  rows.push(['Hired', f.hired]);
  rows.push(['Offer acceptance %', f.offerAcceptanceRate === null ? 'n/a' : `${f.offerAcceptanceRate}%`]);
  return toCsv(rows);
}

export function sourceCsv(s: ReturnType<typeof computeSources>, referralApplies: number): string {
  const rows: Cell[][] = [['Channel', 'Applies', 'Share %']];
  for (const src of s.sources) {
    const pct = s.total > 0 ? Math.round((src.count / s.total) * 1000) / 10 : 0;
    rows.push([src.label, src.count, `${pct}%`]);
  }
  rows.push(['Total applies', s.total, '100%']);
  rows.push([]);
  rows.push(['Referral-attributed applies', referralApplies]);
  rows.push(['Note', 'Per-channel offers/hires are not attributed (applications carry no per-source tag).']);
  return toCsv(rows);
}

export function timeToHireCsv(tth: ReturnType<typeof computeTimeToHire>, stages: ReturnType<typeof computeStageMetrics>): string {
  const rows: Cell[][] = [['Stage', 'Avg days in stage', 'Transitions']];
  for (const st of stages) rows.push([st.label, st.avgDays === null ? 'n/a' : st.avgDays, st.n]);
  rows.push([]);
  rows.push(['Metric', 'Value']);
  rows.push(['Hires', tth.hiredCount]);
  rows.push(['Avg days to hire (from apply)', tth.avgDaysToHire ?? 'n/a']);
  rows.push(['Median days to hire', tth.medianDaysToHire ?? 'n/a']);
  rows.push(['Avg days from job posting to hire', tth.avgDaysFromPost ?? 'n/a']);
  return toCsv(rows);
}
