import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, createNotification, desc, eq, inArray, isNull, sql, tables, type Database } from '@ddotsjobs/db';
import { roleProcedure, router } from '../trpc.js';

const emp = roleProcedure('employer');
const DEFAULT_STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

async function employerId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db.select({ id: tables.employers.id }).from(tables.employers).where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt))).limit(1);
  return row?.id ?? null;
}

async function ownsJob(db: Database, empId: string, jobId: string): Promise<boolean> {
  const [row] = await db.select({ id: tables.jobs.id }).from(tables.jobs).where(and(eq(tables.jobs.id, jobId), eq(tables.jobs.employerId, empId))).limit(1);
  return Boolean(row);
}

// Load an application the employer owns; returns candidate + job ids.
async function loadOwned(db: Database, empId: string, applicationId: string) {
  const a = tables.applications;
  const [row] = await db
    .select({ id: a.id, seekerUserId: a.seekerUserId, jobId: a.jobId, employerId: tables.jobs.employerId, jobTitle: tables.jobs.titleEn })
    .from(a)
    .innerJoin(tables.jobs, eq(tables.jobs.id, a.jobId))
    .where(eq(a.id, applicationId))
    .limit(1);
  if (!row || row.employerId !== empId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your applicant' });
  return row;
}

const appendHistory = (stage: string) => sql`${tables.applications.statusHistory} || ${JSON.stringify([{ status: stage, at: new Date().toISOString() }])}::jsonb`;

async function notifyStage(userId: string, jobTitle: string, stage: string): Promise<void> {
  await createNotification({
    userId,
    type: 'application.stage',
    title: `Your application moved to ${stage}`,
    body: `Update on your application for ${jobTitle}.`,
    actionUrl: '/seeker/applications',
  }).catch(() => {});
}

export const atsRouter = router({
  // Applicants for a job grouped-ready by stage, with AI + fit scores.
  getPipeline: emp.input(z.object({ jobId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId || !(await ownsJob(ctx.db, empId, input.jobId))) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });

    const [pipe] = await ctx.db.select({ stages: tables.hiringPipelines.stages }).from(tables.hiringPipelines).where(eq(tables.hiringPipelines.jobId, input.jobId)).limit(1);
    const stages = pipe?.stages ?? DEFAULT_STAGES;

    const a = tables.applications;
    const sc = tables.applicantScores;
    const rows = await ctx.db
      .select({
        applicationId: a.id,
        userId: a.seekerUserId,
        name: tables.users.nameEn,
        stage: a.stage,
        appliedAt: a.createdAt,
        fitScore: a.fitScoreAtApply,
        aiScore: sc.aiScore,
        notes: a.notesByEmployer,
      })
      .from(a)
      .innerJoin(tables.users, eq(tables.users.id, a.seekerUserId))
      .leftJoin(sc, eq(sc.applicationId, a.id))
      .where(and(eq(a.jobId, input.jobId), isNull(a.withdrawnAt), isNull(a.deletedAt)))
      .orderBy(desc(a.createdAt))
      .limit(300);

    return { stages, applicants: rows.map((r) => ({ ...r, notesCount: r.notes.length })) };
  }),

  moveApplicant: emp
    .input(z.object({ applicationId: z.string().uuid(), newStage: z.string().min(1).max(30) }))
    .mutation(async ({ ctx, input }) => {
      const app = await loadOwned(ctx.db, (await employerId(ctx.db, ctx.user.id))!, input.applicationId);
      await ctx.db.update(tables.applications).set({ stage: input.newStage, stagedAt: new Date(), statusHistory: appendHistory(input.newStage) }).where(eq(tables.applications.id, input.applicationId));
      await notifyStage(app.seekerUserId, app.jobTitle, input.newStage);
      return { ok: true as const };
    }),

  bulkMoveApplicants: emp
    .input(z.object({ applicationIds: z.array(z.string().uuid()).min(1).max(100), newStage: z.string().min(1).max(30) }))
    .mutation(async ({ ctx, input }) => {
      const empId = await employerId(ctx.db, ctx.user.id);
      if (!empId) throw new TRPCError({ code: 'NOT_FOUND' });
      const a = tables.applications;
      // Scope to applications on this employer's jobs.
      const owned = await ctx.db
        .select({ id: a.id })
        .from(a)
        .innerJoin(tables.jobs, eq(tables.jobs.id, a.jobId))
        .where(and(inArray(a.id, input.applicationIds), eq(tables.jobs.employerId, empId)));
      const ids = owned.map((r) => r.id);
      if (ids.length === 0) return { moved: 0 };
      await ctx.db.update(a).set({ stage: input.newStage, stagedAt: new Date(), statusHistory: appendHistory(input.newStage) }).where(inArray(a.id, ids));
      return { moved: ids.length };
    }),

  addNote: emp
    .input(z.object({ applicationId: z.string().uuid(), note: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.db, (await employerId(ctx.db, ctx.user.id))!, input.applicationId);
      const entry = JSON.stringify([{ note: input.note, at: new Date().toISOString() }]);
      await ctx.db.update(tables.applications).set({ notesByEmployer: sql`${tables.applications.notesByEmployer} || ${entry}::jsonb` }).where(eq(tables.applications.id, input.applicationId));
      return { ok: true as const };
    }),

  rejectApplicant: emp
    .input(z.object({ applicationId: z.string().uuid(), reason: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const app = await loadOwned(ctx.db, (await employerId(ctx.db, ctx.user.id))!, input.applicationId);
      const set: Record<string, unknown> = { stage: 'rejected', statusCode: 'rejected', stagedAt: new Date(), statusHistory: appendHistory('rejected') };
      if (input.reason) set.notesByEmployer = sql`${tables.applications.notesByEmployer} || ${JSON.stringify([{ note: `Rejected: ${input.reason}`, at: new Date().toISOString() }])}::jsonb`;
      await ctx.db.update(tables.applications).set(set).where(eq(tables.applications.id, input.applicationId));
      await notifyStage(app.seekerUserId, app.jobTitle, 'not selected');
      return { ok: true as const };
    }),

  customizePipeline: emp
    .input(z.object({ jobId: z.string().uuid(), stages: z.array(z.string().min(1).max(30)).min(2).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const empId = await employerId(ctx.db, ctx.user.id);
      if (!empId || !(await ownsJob(ctx.db, empId, input.jobId))) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });
      const hp = tables.hiringPipelines;
      await ctx.db
        .insert(hp)
        .values({ employerId: empId, jobId: input.jobId, stages: input.stages })
        .onConflictDoUpdate({ target: hp.jobId, set: { stages: input.stages, updatedAt: new Date() } });
      return { ok: true as const };
    }),

  // Send an offer: records it as a note, moves to the offer stage, notifies.
  // (PDF generation + formal accept/decline deferred — see notes.)
  sendOffer: emp
    .input(z.object({ applicationId: z.string().uuid(), position: z.string().min(1).max(200), salary: z.string().max(100), startDate: z.string().max(40).optional(), terms: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const app = await loadOwned(ctx.db, (await employerId(ctx.db, ctx.user.id))!, input.applicationId);
      const offerNote = `OFFER — ${input.position} · ${input.salary}${input.startDate ? ` · starts ${input.startDate}` : ''}${input.terms ? ` · ${input.terms}` : ''}`;
      await ctx.db
        .update(tables.applications)
        .set({ stage: 'offer', stagedAt: new Date(), statusHistory: appendHistory('offer'), notesByEmployer: sql`${tables.applications.notesByEmployer} || ${JSON.stringify([{ note: offerNote, at: new Date().toISOString() }])}::jsonb` })
        .where(eq(tables.applications.id, input.applicationId));
      await createNotification({
        userId: app.seekerUserId,
        type: 'application.offer',
        title: `You've received an offer for ${input.position}`,
        body: `${input.salary}${input.startDate ? ` · starts ${input.startDate}` : ''}. View it in your applications.`,
        actionUrl: '/seeker/applications',
      }).catch(() => {});
      return { ok: true as const };
    }),

  // Full detail for one applicant (notes thread + stage history + scores).
  getApplicantDetail: emp
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const empId = await employerId(ctx.db, ctx.user.id);
      if (!empId) throw new TRPCError({ code: 'NOT_FOUND' });
      const a = tables.applications;
      const [row] = await ctx.db
        .select({
          applicationId: a.id,
          name: tables.users.nameEn,
          stage: a.stage,
          cover: a.questionResponse,
          fitScore: a.fitScoreAtApply,
          aiScore: tables.applicantScores.aiScore,
          aiReasons: tables.applicantScores.matchReasons,
          notes: a.notesByEmployer,
          history: a.statusHistory,
          employerId: tables.jobs.employerId,
        })
        .from(a)
        .innerJoin(tables.users, eq(tables.users.id, a.seekerUserId))
        .innerJoin(tables.jobs, eq(tables.jobs.id, a.jobId))
        .leftJoin(tables.applicantScores, eq(tables.applicantScores.applicationId, a.id))
        .where(eq(a.id, input.applicationId))
        .limit(1);
      if (!row || row.employerId !== empId) throw new TRPCError({ code: 'NOT_FOUND' });
      const { employerId: _e, ...rest } = row;
      return rest;
    }),
});
