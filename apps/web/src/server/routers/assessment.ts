import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, sql, tables } from '@ddotsjobs/db';
import { publicProcedure, protectedProcedure, router } from '../trpc.js';

export const assessmentRouter = router({
  // List assessments + viewer's best score (if any).
  getAssessments: publicProcedure.query(async ({ ctx }) => {
    const a = tables.assessments;
    const uid = ctx.session?.user?.id ?? null;
    return ctx.db
      .select({
        id: a.id,
        slug: a.slug,
        title: a.title,
        description: a.description,
        icon: a.icon,
        passingScore: a.passingScore,
        totalQuestions: a.totalQuestions,
        bestScore: uid
          ? sql<number | null>`(select max(score) from ${tables.assessmentAttempts} aa where aa.assessment_id = ${a.id} and aa.user_id = ${uid})`
          : sql<number | null>`null`,
        passed: uid
          ? sql<boolean>`exists (select 1 from ${tables.userBadges} ub where ub.assessment_id = ${a.id} and ub.user_id = ${uid})`
          : sql<boolean>`false`,
      })
      .from(a)
      .orderBy(asc(a.title));
  }),

  // Questions WITHOUT correct answers + viewer's past attempts. Login required.
  getAssessmentDetail: protectedProcedure
    .input(z.object({ slug: z.string().max(60) }))
    .query(async ({ ctx, input }) => {
      const [assessment] = await ctx.db.select().from(tables.assessments).where(eq(tables.assessments.slug, input.slug)).limit(1);
      if (!assessment) throw new TRPCError({ code: 'NOT_FOUND' });
      const questions = await ctx.db
        .select({
          id: tables.assessmentQuestions.id,
          questionNumber: tables.assessmentQuestions.questionNumber,
          questionText: tables.assessmentQuestions.questionText,
          optionA: tables.assessmentQuestions.optionA,
          optionB: tables.assessmentQuestions.optionB,
          optionC: tables.assessmentQuestions.optionC,
          optionD: tables.assessmentQuestions.optionD,
        })
        .from(tables.assessmentQuestions)
        .where(eq(tables.assessmentQuestions.assessmentId, assessment.id))
        .orderBy(asc(tables.assessmentQuestions.questionNumber));
      const attempts = await ctx.db
        .select({ score: tables.assessmentAttempts.score, passed: tables.assessmentAttempts.passed, attemptedAt: tables.assessmentAttempts.attemptedAt })
        .from(tables.assessmentAttempts)
        .where(and(eq(tables.assessmentAttempts.assessmentId, assessment.id), eq(tables.assessmentAttempts.userId, ctx.user.id)))
        .orderBy(desc(tables.assessmentAttempts.attemptedAt))
        .limit(10);
      return { assessment: { id: assessment.id, slug: assessment.slug, title: assessment.title, icon: assessment.icon, passingScore: assessment.passingScore, totalQuestions: assessment.totalQuestions }, questions, attempts };
    }),

  submitAssessment: protectedProcedure
    .input(z.object({ slug: z.string().max(60), answers: z.record(z.string(), z.enum(['A', 'B', 'C', 'D'])) }))
    .mutation(async ({ ctx, input }) => {
      const [assessment] = await ctx.db.select().from(tables.assessments).where(eq(tables.assessments.slug, input.slug)).limit(1);
      if (!assessment) throw new TRPCError({ code: 'NOT_FOUND' });
      const questions = await ctx.db
        .select({ number: tables.assessmentQuestions.questionNumber, correct: tables.assessmentQuestions.correctAnswer, explanation: tables.assessmentQuestions.explanation, questionText: tables.assessmentQuestions.questionText, optionA: tables.assessmentQuestions.optionA, optionB: tables.assessmentQuestions.optionB, optionC: tables.assessmentQuestions.optionC, optionD: tables.assessmentQuestions.optionD })
        .from(tables.assessmentQuestions)
        .where(eq(tables.assessmentQuestions.assessmentId, assessment.id))
        .orderBy(asc(tables.assessmentQuestions.questionNumber));
      if (questions.length === 0) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No questions' });

      let correctCount = 0;
      const breakdown = questions.map((q) => {
        const given = input.answers[String(q.number)] ?? null;
        const isCorrect = given === q.correct;
        if (isCorrect) correctCount++;
        return {
          number: q.number,
          questionText: q.questionText,
          options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
          yourAnswer: given,
          correctAnswer: q.correct,
          isCorrect,
          explanation: q.explanation,
        };
      });
      const score = Math.round((correctCount / questions.length) * 100);
      const passed = score >= assessment.passingScore;

      await ctx.db.insert(tables.assessmentAttempts).values({
        userId: ctx.user.id,
        assessmentId: assessment.id,
        score,
        passed,
        answersJson: input.answers,
      });

      let badgeEarned = false;
      if (passed) {
        const res = await ctx.db
          .insert(tables.userBadges)
          .values({ userId: ctx.user.id, assessmentId: assessment.id })
          .onConflictDoNothing()
          .returning({ id: tables.userBadges.id });
        badgeEarned = res.length > 0;
      }

      return { score, passed, badgeEarned, breakdown, passingScore: assessment.passingScore };
    }),

  getUserBadges: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        assessmentId: tables.userBadges.assessmentId,
        title: tables.assessments.title,
        slug: tables.assessments.slug,
        icon: tables.assessments.icon,
        earnedAt: tables.userBadges.earnedAt,
        bestScore: sql<number>`(select max(score) from ${tables.assessmentAttempts} aa where aa.assessment_id = ${tables.userBadges.assessmentId} and aa.user_id = ${ctx.user.id})`,
      })
      .from(tables.userBadges)
      .innerJoin(tables.assessments, eq(tables.assessments.id, tables.userBadges.assessmentId))
      .where(eq(tables.userBadges.userId, ctx.user.id))
      .orderBy(desc(tables.userBadges.earnedAt));
  }),

  getAttemptHistory: protectedProcedure
    .input(z.object({ assessmentId: z.string().uuid(), limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({ score: tables.assessmentAttempts.score, passed: tables.assessmentAttempts.passed, attemptedAt: tables.assessmentAttempts.attemptedAt })
        .from(tables.assessmentAttempts)
        .where(and(eq(tables.assessmentAttempts.assessmentId, input.assessmentId), eq(tables.assessmentAttempts.userId, ctx.user.id)))
        .orderBy(desc(tables.assessmentAttempts.attemptedAt))
        .limit(input.limit);
    }),
});
