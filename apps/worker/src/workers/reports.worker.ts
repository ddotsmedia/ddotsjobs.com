import { Resend } from 'resend';
import {
  and,
  db,
  eq,
  tables,
  computeFunnel,
  computeSources,
  computeStageMetrics,
  computeTimeToHire,
  fetchApplicationsForReport,
  fetchReferralApplies,
} from '@ddotsjobs/db';
import { queues } from '../queues.js';
import { logger } from '../lib/logger.js';

const WEEKLY_JOB = 'scheduled_reports_weekly';
const MONTHLY_JOB = 'scheduled_reports_monthly';
const FROM = process.env.OTP_FROM ?? 'ddotsjobs <noreply@ddotsjobs.com>';
const TYPE_LABEL: Record<string, string> = {
  hiring_funnel: 'Hiring Funnel',
  applicant_source: 'Applicant Source',
  time_to_hire: 'Time to Hire',
};

/** Weekly (Mon 09:00 IST ≈ 03:30 UTC) + monthly (1st) scheduled-report crons. */
export async function registerScheduledReportCrons(): Promise<void> {
  await queues.maintenance.add(WEEKLY_JOB, {}, { repeat: { pattern: '30 3 * * 1' }, jobId: 'scheduled-reports-weekly-cron', removeOnComplete: true });
  await queues.maintenance.add(MONTHLY_JOB, {}, { repeat: { pattern: '30 3 1 * *' }, jobId: 'scheduled-reports-monthly-cron', removeOnComplete: true });
}

/** Default OFF — admin flips site_setting scheduled_reports_active to 'true'. */
async function reportsActive(): Promise<boolean> {
  try {
    const [row] = await db.select({ value: tables.siteSettings.value }).from(tables.siteSettings).where(eq(tables.siteSettings.key, 'scheduled_reports_active')).limit(1);
    return (row?.value ?? 'false') === 'true';
  } catch {
    return false;
  }
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function table(headers: string[], rows: (string | number)[][]): string {
  const th = headers.map((h) => `<th style="text-align:left;padding:8px 10px;background:#f4f4ef;border-bottom:2px solid #e2e2da;font-size:12px;color:#55554f">${esc(h)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td style="padding:8px 10px;border-bottom:1px solid #f0f0ea;font-size:13px">${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

async function buildHtml(db2: typeof db, empId: string, reportType: string, companyName: string, rangeLabel: string, fromIso: string): Promise<string> {
  const rows = await fetchApplicationsForReport(db2, empId, { from: fromIso });
  let inner = '';
  if (reportType === 'hiring_funnel') {
    const f = computeFunnel(rows);
    inner =
      `<p style="font-size:14px">Applied <b>${f.total}</b> · Offers <b>${f.offersSent}</b> · Hired <b>${f.hired}</b> · Offer acceptance <b>${f.offerAcceptanceRate === null ? '—' : `${f.offerAcceptanceRate}%`}</b></p>` +
      table(['Stage', 'Count', 'Conversion %', 'Drop-off %', 'Overall %'], f.stages.map((s) => [s.label, s.count, `${s.conversionPct}%`, `${s.dropoffPct}%`, `${s.overallPct}%`]));
  } else if (reportType === 'applicant_source') {
    const s = computeSources(rows);
    const ref = await fetchReferralApplies(db2, empId);
    inner =
      table(['Channel', 'Applies', 'Share %'], s.sources.map((sc) => [sc.label, sc.count, `${s.total > 0 ? Math.round((sc.count / s.total) * 1000) / 10 : 0}%`])) +
      `<p style="font-size:13px;color:#6b6b66">Referral-attributed applies: <b>${ref}</b></p>`;
  } else {
    const tth = computeTimeToHire(rows);
    const stages = computeStageMetrics(rows);
    inner =
      `<p style="font-size:14px">Hires <b>${tth.hiredCount}</b> · Avg days to hire <b>${tth.avgDaysToHire ?? '—'}</b> · Median <b>${tth.medianDaysToHire ?? '—'}</b></p>` +
      table(['Stage', 'Avg days in stage', 'Transitions'], stages.map((st) => [st.label, st.avgDays ?? '—', st.n]));
  }
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1916">
    <div style="font-size:22px;font-weight:800;font-style:italic;color:#3A9EA5;margin-bottom:6px">ddotsjobs<span style="color:#F5C842">.</span></div>
    <h2 style="font-size:20px;margin:4px 0">${esc(TYPE_LABEL[reportType] ?? reportType)} — ${esc(companyName)}</h2>
    <div style="font-size:13px;color:#6b6b66">${esc(rangeLabel)}</div>
    ${inner}
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0 10px"/>
    <p style="font-size:12px;color:#9a9a92">Scheduled report from ddotsjobs.com. Manage or unsubscribe in Employer → Reports.</p>
  </div>`;
}

export async function runScheduledReports(frequency: 'weekly' | 'monthly'): Promise<{ sent: number; skipped?: string }> {
  if (!(await reportsActive())) return { sent: 0, skipped: 'disabled' };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, skipped: 'no-resend-key' };

  const days = frequency === 'weekly' ? 7 : 30;
  const rangeLabel = frequency === 'weekly' ? 'Last 7 days' : 'Last 30 days';
  const fromIso = new Date(Date.now() - days * 86_400_000).toISOString();
  const reports = await db
    .select({
      id: tables.scheduledReports.id,
      employerId: tables.scheduledReports.employerId,
      reportType: tables.scheduledReports.reportType,
      recipients: tables.scheduledReports.recipients,
      companyName: tables.employers.displayNameEn,
    })
    .from(tables.scheduledReports)
    .innerJoin(tables.employers, eq(tables.employers.id, tables.scheduledReports.employerId))
    .where(and(eq(tables.scheduledReports.frequency, frequency), eq(tables.scheduledReports.isActive, true)));

  const resend = new Resend(key);
  let sent = 0;
  for (const r of reports) {
    if (!r.recipients.length) continue;
    let html: string;
    try {
      html = await buildHtml(db, r.employerId, r.reportType, r.companyName ?? 'Your company', rangeLabel, fromIso);
    } catch (err) {
      logger.error({ err: (err as Error).message, reportId: r.id }, 'report build failed');
      continue;
    }
    const subject = `${TYPE_LABEL[r.reportType] ?? 'Analytics'} report — ${rangeLabel}`;
    for (const email of r.recipients) {
      let status = 'sent';
      try {
        await resend.emails.send({ from: FROM, to: email, subject, html });
        sent += 1;
      } catch (err) {
        status = 'failed';
        logger.error({ err: (err as Error).message, email }, 'report email failed');
      }
      await db.insert(tables.emailLogs).values({ userId: null, eventType: 'scheduled_report', recipientEmail: email, subject, status }).catch(() => {});
    }
    await db.update(tables.scheduledReports).set({ lastSentAt: new Date() }).where(eq(tables.scheduledReports.id, r.id));
  }
  return { sent };
}
