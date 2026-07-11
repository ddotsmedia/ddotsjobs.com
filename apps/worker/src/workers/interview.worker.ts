import { asc, db, eq, tables } from '@ddotsjobs/db';
import { callAI } from '@ddotsjobs/ai';
import { interviewAnalysisPrompt } from '@ddotsjobs/ai/prompts';
import { logger } from '../lib/logger.js';

// Async AI analysis of an interview's answer transcripts (ai queue,
// job name 'analyze_interview'). Runs in the worker so the employer's
// request never blocks on the model call.
export async function runInterviewAnalysis(data: { interviewId: string }): Promise<unknown> {
  const { interviewId } = data;
  const vi = tables.videoInterviews;
  const [iv] = await db
    .select({ jobTitle: tables.jobs.titleEn })
    .from(vi)
    .innerJoin(tables.jobs, eq(tables.jobs.id, vi.jobId))
    .where(eq(vi.id, interviewId))
    .limit(1);
  if (!iv) return { skipped: 'no-interview' as const };

  const rows = await db
    .select({ question: tables.interviewQuestions.questionText, order: tables.interviewQuestions.order, transcript: tables.interviewVideos.transcript })
    .from(tables.interviewQuestions)
    .leftJoin(tables.interviewVideos, eq(tables.interviewVideos.questionId, tables.interviewQuestions.id))
    .where(eq(tables.interviewQuestions.interviewId, interviewId))
    .orderBy(asc(tables.interviewQuestions.order));
  const qa = rows.filter((r) => r.transcript && r.transcript.trim()).map((r) => ({ question: r.question, answer: r.transcript!.trim() }));
  if (qa.length === 0) return { skipped: 'no-transcript' as const };

  const spec = interviewAnalysisPrompt({ jobTitle: iv.jobTitle, qa });
  const { data: analysis } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
  await db.update(vi).set({ aiAnalysis: analysis }).where(eq(vi.id, interviewId));
  logger.info({ interviewId }, '[interview] AI analysis stored');
  return { ok: true as const };
}
