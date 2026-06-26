import { callAI } from '@ddotsjobs/ai';
import { fitExplainScorePrompt } from '@ddotsjobs/ai/prompts';
import { db, eq, tables } from '@ddotsjobs/db';

interface FitExplainJob {
  fitResult: {
    overall: number;
    qualification: number;
    experience: number;
    location: number;
    salary: number;
    certBonus: number;
  };
  jobCategory: string;
  seekerLanguage: string;
  fitScoreId: string;
}

export async function runFitExplain(raw: unknown): Promise<{ status: string }> {
  const data = raw as FitExplainJob;
  if (!data?.fitScoreId) return { status: 'skipped' };

  const spec = fitExplainScorePrompt({
    overallScore: data.fitResult.overall,
    qualificationScore: data.fitResult.qualification,
    experienceScore: data.fitResult.experience,
    locationScore: data.fitResult.location,
    salaryScore: data.fitResult.salary,
    jobCategory: data.jobCategory,
    seekerLanguage: data.seekerLanguage,
    hasRequiredCert: data.fitResult.certBonus > 0,
    missingCerts: [],
  });

  const { data: out } = await callAI({
    task: spec.task,
    prompt: spec.prompt,
    system: spec.system,
    schema: spec.schema,
  });

  const set = data.seekerLanguage === 'ml' ? { explanationMl: out.summary } : { explanationEn: out.summary };
  await db.update(tables.fitScores).set(set).where(eq(tables.fitScores.id, data.fitScoreId));

  return { status: 'ok' };
}
