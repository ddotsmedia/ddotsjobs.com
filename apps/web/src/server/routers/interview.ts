import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, createNotification, desc, eq, tables, type Database } from '@ddotsjobs/db';
import { callAI } from '@ddotsjobs/ai';
import { interviewGenerateQuestionsPrompt, interviewAnalysisPrompt } from '@ddotsjobs/ai/prompts';
import { protectedProcedure, roleProcedure, router } from '../trpc.js';
import { rateLimit } from '../rate-limit.js';
import { assertAiEnabled } from '@/lib/site-settings';

const emp = roleProcedure('employer');

async function ownsJob(db: Database, userId: string, jobId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tables.jobs.id })
    .from(tables.jobs)
    .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
    .where(and(eq(tables.jobs.id, jobId), eq(tables.employers.ownerUserId, userId)))
    .limit(1);
  return Boolean(row);
}

export const interviewRouter = router({
  generateQuestions: protectedProcedure
    .input(
      z.object({
        jobTitle: z.string().min(2).max(120),
        category: z.string().max(60).default(''),
        employerType: z.string().max(60).default(''),
        language: z.enum(['ml', 'en']).default('ml'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAiEnabled();
      await rateLimit(ctx.redis, `interview:${ctx.user.id}`, 20, 86_400);
      const spec = interviewGenerateQuestionsPrompt(input);
      const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
      return data;
    }),

  // ── Async video interviews (Phase 3.10) ──────────────────────────────
  // Employer creates an interview for a candidate with a set of questions.
  createInterview: emp
    .input(
      z.object({
        jobId: z.string().uuid(),
        candidateUserId: z.string().uuid(),
        questions: z.array(z.object({ text: z.string().min(3).max(500), timeLimit: z.number().int().min(30).max(300).default(120) })).min(1).max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await ownsJob(ctx.db, ctx.user.id, input.jobId))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });
      }
      const [vi] = await ctx.db
        .insert(tables.videoInterviews)
        .values({ jobId: input.jobId, interviewerId: ctx.user.id, candidateId: input.candidateUserId, status: 'scheduled' })
        .returning({ id: tables.videoInterviews.id });
      if (!vi) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await ctx.db.insert(tables.interviewQuestions).values(
        input.questions.map((q, i) => ({ interviewId: vi.id, questionText: q.text, timeLimit: q.timeLimit, order: i })),
      );

      const [job] = await ctx.db.select({ title: tables.jobs.titleEn }).from(tables.jobs).where(eq(tables.jobs.id, input.jobId)).limit(1);
      await createNotification({
        userId: input.candidateUserId,
        type: 'interview.invited',
        title: 'You have a video interview invitation',
        titleMl: 'നിങ്ങൾക്ക് ഒരു വീഡിയോ ഇന്റർവ്യൂ ക്ഷണം ഉണ്ട്',
        body: `Record your responses for ${job?.title ?? 'a role'}.`,
        actionUrl: `/interview/${vi.id}`,
      }).catch(() => {});
      return { interviewId: vi.id };
    }),

  // Candidate: interviews assigned to me. Employer: interviews I created.
  myInterviews: protectedProcedure.query(async ({ ctx }) => {
    const vi = tables.videoInterviews;
    const isEmployer = ctx.user.role === 'employer';
    const rows = await ctx.db
      .select({
        id: vi.id,
        status: vi.status,
        createdAt: vi.createdAt,
        submittedAt: vi.submittedAt,
        jobTitle: tables.jobs.titleEn,
        counterpartName: tables.users.nameEn,
      })
      .from(vi)
      .innerJoin(tables.jobs, eq(tables.jobs.id, vi.jobId))
      .innerJoin(tables.users, eq(tables.users.id, isEmployer ? vi.candidateId : vi.interviewerId))
      .where(eq(isEmployer ? vi.interviewerId : vi.candidateId, ctx.user.id))
      .orderBy(desc(vi.createdAt))
      .limit(100);
    return { role: isEmployer ? ('employer' as const) : ('candidate' as const), items: rows };
  }),

  // Candidate recording page: questions + which are already answered.
  getForCandidate: protectedProcedure
    .input(z.object({ interviewId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vi = tables.videoInterviews;
      const [iv] = await ctx.db
        .select({ id: vi.id, status: vi.status, candidateId: vi.candidateId, jobTitle: tables.jobs.titleEn })
        .from(vi)
        .innerJoin(tables.jobs, eq(tables.jobs.id, vi.jobId))
        .where(eq(vi.id, input.interviewId))
        .limit(1);
      if (!iv || iv.candidateId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'Interview not found' });

      const questions = await ctx.db
        .select({ id: tables.interviewQuestions.id, text: tables.interviewQuestions.questionText, timeLimit: tables.interviewQuestions.timeLimit, order: tables.interviewQuestions.order })
        .from(tables.interviewQuestions)
        .where(eq(tables.interviewQuestions.interviewId, input.interviewId))
        .orderBy(asc(tables.interviewQuestions.order));
      const answered = await ctx.db
        .select({ questionId: tables.interviewVideos.questionId })
        .from(tables.interviewVideos)
        .where(eq(tables.interviewVideos.interviewId, input.interviewId));
      return { status: iv.status, jobTitle: iv.jobTitle, questions, answeredIds: answered.map((a) => a.questionId) };
    }),

  submitInterview: protectedProcedure
    .input(z.object({ interviewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const vi = tables.videoInterviews;
      const [iv] = await ctx.db.select({ candidateId: vi.candidateId, interviewerId: vi.interviewerId }).from(vi).where(eq(vi.id, input.interviewId)).limit(1);
      if (!iv || iv.candidateId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      await ctx.db.update(vi).set({ status: 'submitted', submittedAt: new Date() }).where(eq(vi.id, input.interviewId));
      await createNotification({
        userId: iv.interviewerId,
        type: 'interview.submitted',
        title: 'A candidate submitted their video interview',
        body: 'Review their responses.',
        actionUrl: `/employer/interviews/${input.interviewId}`,
      }).catch(() => {});
      return { ok: true as const };
    }),

  // Employer playback: questions + recorded videos.
  getPlayback: emp
    .input(z.object({ interviewId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vi = tables.videoInterviews;
      const [iv] = await ctx.db
        .select({ id: vi.id, status: vi.status, interviewerId: vi.interviewerId, submittedAt: vi.submittedAt, aiAnalysis: vi.aiAnalysis, jobTitle: tables.jobs.titleEn, candidateName: tables.users.nameEn })
        .from(vi)
        .innerJoin(tables.jobs, eq(tables.jobs.id, vi.jobId))
        .innerJoin(tables.users, eq(tables.users.id, vi.candidateId))
        .where(eq(vi.id, input.interviewId))
        .limit(1);
      if (!iv || iv.interviewerId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'Interview not found' });

      const rows = await ctx.db
        .select({
          questionId: tables.interviewQuestions.id,
          text: tables.interviewQuestions.questionText,
          order: tables.interviewQuestions.order,
          storagePath: tables.interviewVideos.storagePath,
          duration: tables.interviewVideos.duration,
          transcript: tables.interviewVideos.transcript,
        })
        .from(tables.interviewQuestions)
        .leftJoin(tables.interviewVideos, eq(tables.interviewVideos.questionId, tables.interviewQuestions.id))
        .where(eq(tables.interviewQuestions.interviewId, input.interviewId))
        .orderBy(asc(tables.interviewQuestions.order));
      return { status: iv.status, jobTitle: iv.jobTitle, candidateName: iv.candidateName, submittedAt: iv.submittedAt, aiAnalysis: iv.aiAnalysis, questions: rows };
    }),

  // Save the transcript for one answer (manual entry until ASR is wired).
  saveTranscript: emp
    .input(z.object({ questionId: z.string().uuid(), interviewId: z.string().uuid(), transcript: z.string().max(8000) }))
    .mutation(async ({ ctx, input }) => {
      const vi = tables.videoInterviews;
      const [iv] = await ctx.db.select({ interviewerId: vi.interviewerId }).from(vi).where(eq(vi.id, input.interviewId)).limit(1);
      if (!iv || iv.interviewerId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      await ctx.db
        .update(tables.interviewVideos)
        .set({ transcript: input.transcript })
        .where(and(eq(tables.interviewVideos.interviewId, input.interviewId), eq(tables.interviewVideos.questionId, input.questionId)));
      return { ok: true as const };
    }),

  // Analyse the interview transcripts with AI (sentiment/engagement/score/…).
  analyzeInterview: emp
    .input(z.object({ interviewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const vi = tables.videoInterviews;
      const [iv] = await ctx.db
        .select({ interviewerId: vi.interviewerId, jobTitle: tables.jobs.titleEn })
        .from(vi)
        .innerJoin(tables.jobs, eq(tables.jobs.id, vi.jobId))
        .where(eq(vi.id, input.interviewId))
        .limit(1);
      if (!iv || iv.interviewerId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your interview' });

      const rows = await ctx.db
        .select({ question: tables.interviewQuestions.questionText, order: tables.interviewQuestions.order, transcript: tables.interviewVideos.transcript })
        .from(tables.interviewQuestions)
        .leftJoin(tables.interviewVideos, eq(tables.interviewVideos.questionId, tables.interviewQuestions.id))
        .where(eq(tables.interviewQuestions.interviewId, input.interviewId))
        .orderBy(asc(tables.interviewQuestions.order));
      const qa = rows.filter((r) => r.transcript && r.transcript.trim()).map((r) => ({ question: r.question, answer: r.transcript!.trim() }));
      if (qa.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Add at least one answer transcript before analysing.' });

      await assertAiEnabled();
      await rateLimit(ctx.redis, `interview-ai:${ctx.user.id}`, 50, 86_400);
      const spec = interviewAnalysisPrompt({ jobTitle: iv.jobTitle, qa });
      const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
      await ctx.db.update(vi).set({ aiAnalysis: data }).where(eq(vi.id, input.interviewId));
      return data;
    }),

  markReviewed: emp
    .input(z.object({ interviewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const vi = tables.videoInterviews;
      const [iv] = await ctx.db.select({ interviewerId: vi.interviewerId }).from(vi).where(eq(vi.id, input.interviewId)).limit(1);
      if (!iv || iv.interviewerId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      await ctx.db.update(vi).set({ status: 'reviewed', reviewedAt: new Date() }).where(eq(vi.id, input.interviewId));
      return { ok: true as const };
    }),
});
