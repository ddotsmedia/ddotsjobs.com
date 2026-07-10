import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql, tables, type Database } from '@ddotsjobs/db';
import { callAI } from '@ddotsjobs/ai';
import { applicantScreeningPrompt } from '@ddotsjobs/ai/prompts';
import { roleProcedure, router } from '../trpc.js';
import { rateLimit } from '../rate-limit.js';
import { assertAiEnabled } from '@/lib/site-settings';

const emp = roleProcedure('employer');

async function employerId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: tables.employers.id })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

type Ctx = { db: Database; user: { id: string }; redis: Parameters<typeof rateLimit>[0] };

// Run AI screening for one application the caller owns; upsert the result.
async function runScore(ctx: Ctx, applicationId: string) {
  const empId = await employerId(ctx.db, ctx.user.id);
  if (!empId) throw new TRPCError({ code: 'NOT_FOUND', message: 'No employer account' });

  const a = tables.applications;
  const j = tables.jobs;
  const [app] = await ctx.db
    .select({
      appId: a.id,
      jobId: a.jobId,
      seekerUserId: a.seekerUserId,
      jobEmployerId: j.employerId,
      jobTitle: j.titleEn,
      jobDesc: j.descriptionEn,
      jobSkills: j.skills,
      jobReq: j.requirementsEn,
      jobDistrict: j.district,
    })
    .from(a)
    .innerJoin(j, eq(j.id, a.jobId))
    .where(and(eq(a.id, applicationId), isNull(a.deletedAt)))
    .limit(1);
  if (!app || app.jobEmployerId !== empId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your application' });

  const [u] = await ctx.db
    .select({ name: tables.users.nameEn, profession: tables.users.primaryProfession })
    .from(tables.users)
    .where(eq(tables.users.id, app.seekerUserId))
    .limit(1);
  const [p] = await ctx.db
    .select({ headline: tables.seekerProfiles.headlineEn, skills: tables.seekerProfiles.skills, months: tables.seekerProfiles.totalExperienceMonths })
    .from(tables.seekerProfiles)
    .where(eq(tables.seekerProfiles.userId, app.seekerUserId))
    .limit(1);

  await assertAiEnabled();
  const spec = applicantScreeningPrompt({
    job: { titleEn: app.jobTitle, descriptionEn: app.jobDesc ?? '', skills: app.jobSkills ?? [], requirementsEn: app.jobReq ?? null, district: app.jobDistrict ?? null },
    applicant: {
      name: u?.name ?? 'Applicant',
      profession: u?.profession ?? 'professional',
      headlineEn: p?.headline ?? null,
      skills: p?.skills ?? [],
      experienceMonths: p?.months ?? 0,
      certifications: [],
    },
  });
  const { data, tier } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });

  const sc = tables.applicantScores;
  await ctx.db
    .insert(sc)
    .values({ applicationId: app.appId, jobId: app.jobId, userId: app.seekerUserId, aiScore: data.score, matchReasons: data.matchReasons, reasoning: data.reasoning, model: tier })
    .onConflictDoUpdate({
      target: sc.applicationId,
      set: { aiScore: data.score, matchReasons: data.matchReasons, reasoning: data.reasoning, model: tier, scoredAt: new Date() },
    });

  return { applicationId: app.appId, score: data.score, matchReasons: data.matchReasons, reasoning: data.reasoning };
}

export const screeningRouter = router({
  // Score (or re-score) a single application with AI. On-demand.
  scoreApplication: emp
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.redis, `screen:${ctx.user.id}`, 200, 86_400);
      return runScore(ctx, input.applicationId);
    }),

  rescoreApplication: emp
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.redis, `screen:${ctx.user.id}`, 200, 86_400);
      return runScore(ctx, input.applicationId);
    }),

  // Ranked applicant list for a job (scored first, high → low). Employer-only.
  getApplicantScores: emp
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const empId = await employerId(ctx.db, ctx.user.id);
      if (!empId) return { jobTitle: null, applicants: [] };
      const [job] = await ctx.db
        .select({ id: tables.jobs.id, title: tables.jobs.titleEn })
        .from(tables.jobs)
        .where(and(eq(tables.jobs.id, input.jobId), eq(tables.jobs.employerId, empId), isNull(tables.jobs.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });

      const a = tables.applications;
      const sc = tables.applicantScores;
      const rows = await ctx.db
        .select({
          applicationId: a.id,
          userId: a.seekerUserId,
          statusCode: a.statusCode,
          appliedAt: a.createdAt,
          fitScore: a.fitScore,
          name: tables.users.nameEn,
          profession: tables.users.primaryProfession,
          aiScore: sc.aiScore,
          matchReasons: sc.matchReasons,
          reasoning: sc.reasoning,
          scoredAt: sc.scoredAt,
        })
        .from(a)
        .innerJoin(tables.users, eq(tables.users.id, a.seekerUserId))
        .leftJoin(sc, eq(sc.applicationId, a.id))
        .where(and(eq(a.jobId, input.jobId), isNull(a.withdrawnAt), isNull(a.deletedAt)))
        .orderBy(sql`${sc.aiScore} desc nulls last`, desc(a.createdAt))
        .limit(200);

      return { jobTitle: job.title, applicants: rows };
    }),

  getScoreDetails: emp
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const empId = await employerId(ctx.db, ctx.user.id);
      if (!empId) return null;
      const sc = tables.applicantScores;
      const j = tables.jobs;
      const [row] = await ctx.db
        .select({ aiScore: sc.aiScore, matchReasons: sc.matchReasons, reasoning: sc.reasoning, model: sc.model, scoredAt: sc.scoredAt })
        .from(sc)
        .innerJoin(j, eq(j.id, sc.jobId))
        .where(and(eq(sc.applicationId, input.applicationId), eq(j.employerId, empId)))
        .limit(1);
      return row ?? null;
    }),
});
