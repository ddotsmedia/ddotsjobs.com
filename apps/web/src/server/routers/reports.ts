import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  and,
  desc,
  eq,
  tables,
  computeFunnel,
  computeSources,
  computeStageMetrics,
  computeTimeToHire,
  fetchApplicationsForReport,
  fetchReferralApplies,
  resolveEmployerId,
  type Database,
} from '@ddotsjobs/db';
import { roleProcedure, router } from '../trpc.js';
import { funnelCsv, sourceCsv, timeToHireCsv } from '@/lib/report-csv';

const emp = roleProcedure('employer');
const REPORT_TYPES = ['hiring_funnel', 'applicant_source', 'time_to_hire'] as const;
const FREQUENCIES = ['weekly', 'monthly'] as const;
const CRON = { weekly: '0 5 * * 1', monthly: '0 5 1 * *' } as const;
const TYPE_LABEL: Record<string, string> = {
  hiring_funnel: 'Hiring funnel',
  applicant_source: 'Applicant source',
  time_to_hire: 'Time to hire',
};

const rangeInput = z.object({
  reportType: z.enum(REPORT_TYPES),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  jobId: z.string().uuid().optional(),
  category: z.string().max(100).optional(),
});

const recipients = z.array(z.string().email()).min(1).max(10);

async function ownReport(db: Database, empId: string, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tables.scheduledReports.id })
    .from(tables.scheduledReports)
    .where(and(eq(tables.scheduledReports.id, id), eq(tables.scheduledReports.employerId, empId)))
    .limit(1);
  return Boolean(row);
}

export const reportsRouter = router({
  // Generate a CSV server-side; the client turns { csv } into a Blob download.
  exportAnalyticsAsCSV: emp.input(rangeInput).mutation(async ({ ctx, input }) => {
    const empId = await resolveEmployerId(ctx.db, ctx.user.id);
    if (!empId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Register your company first' });
    const rows = await fetchApplicationsForReport(ctx.db, empId, input);

    let csv: string;
    if (input.reportType === 'hiring_funnel') csv = funnelCsv(computeFunnel(rows));
    else if (input.reportType === 'applicant_source') csv = sourceCsv(computeSources(rows), await fetchReferralApplies(ctx.db, empId));
    else csv = timeToHireCsv(computeTimeToHire(rows), computeStageMetrics(rows));

    const date = new Date().toISOString().slice(0, 10);
    return { filename: `ddotsjobs-${input.reportType}-${date}.csv`, csv };
  }),

  // PDF = browser print of the dedicated print view (no PDF dependency).
  exportAnalyticsAsPDF: emp.input(rangeInput).query(async ({ input }) => {
    const params = new URLSearchParams({ type: input.reportType });
    if (input.from) params.set('from', input.from);
    if (input.to) params.set('to', input.to);
    if (input.jobId) params.set('jobId', input.jobId);
    if (input.category) params.set('category', input.category);
    return { url: `/employer/reports/print?${params.toString()}` };
  }),

  scheduleReport: emp
    .input(z.object({ reportType: z.enum(REPORT_TYPES), frequency: z.enum(FREQUENCIES), recipients }))
    .mutation(async ({ ctx, input }) => {
      const empId = await resolveEmployerId(ctx.db, ctx.user.id);
      if (!empId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Register your company first' });
      const [row] = await ctx.db
        .insert(tables.scheduledReports)
        .values({ employerId: empId, reportType: input.reportType, frequency: input.frequency, sendAt: CRON[input.frequency], recipients: input.recipients })
        .returning({ id: tables.scheduledReports.id });
      return { id: row!.id };
    }),

  getScheduledReports: emp.query(async ({ ctx }) => {
    const empId = await resolveEmployerId(ctx.db, ctx.user.id);
    if (!empId) return [];
    const rows = await ctx.db
      .select({
        id: tables.scheduledReports.id,
        reportType: tables.scheduledReports.reportType,
        frequency: tables.scheduledReports.frequency,
        recipients: tables.scheduledReports.recipients,
        isActive: tables.scheduledReports.isActive,
        lastSentAt: tables.scheduledReports.lastSentAt,
        createdAt: tables.scheduledReports.createdAt,
      })
      .from(tables.scheduledReports)
      .where(eq(tables.scheduledReports.employerId, empId))
      .orderBy(desc(tables.scheduledReports.createdAt));
    return rows.map((r) => ({ ...r, typeLabel: TYPE_LABEL[r.reportType] ?? r.reportType }));
  }),

  updateScheduledReport: emp
    .input(
      z.object({
        id: z.string().uuid(),
        frequency: z.enum(FREQUENCIES).optional(),
        recipients: recipients.optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const empId = await resolveEmployerId(ctx.db, ctx.user.id);
      if (!empId || !(await ownReport(ctx.db, empId, input.id))) throw new TRPCError({ code: 'FORBIDDEN' });
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.frequency !== undefined) {
        set.frequency = input.frequency;
        set.sendAt = CRON[input.frequency];
      }
      if (input.recipients !== undefined) set.recipients = input.recipients;
      if (input.isActive !== undefined) set.isActive = input.isActive;
      await ctx.db.update(tables.scheduledReports).set(set).where(eq(tables.scheduledReports.id, input.id));
      return { ok: true as const };
    }),

  deleteScheduledReport: emp.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const empId = await resolveEmployerId(ctx.db, ctx.user.id);
    if (!empId) throw new TRPCError({ code: 'NOT_FOUND' });
    await ctx.db.delete(tables.scheduledReports).where(and(eq(tables.scheduledReports.id, input.id), eq(tables.scheduledReports.employerId, empId)));
    return { ok: true as const };
  }),
});
