import { z } from 'zod';
import type { TaskKind } from '@ddotsjobs/config/models';

// All AI prompts live here as named, versioned functions. Never inline a prompt
// at a call site. Each builder returns the task tier, system text, user prompt,
// and an output schema so callAI() can validate structured results.

export interface PromptSpec<T> {
  task: TaskKind;
  version: number;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}

// ── Bilingual fields shared by many outputs ─────────────────────────────
const bilingual = z.object({ ml: z.string(), en: z.string() });

// ── Job fit score (Sonnet reasoning tier) ───────────────────────────────
export const fitScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  breakdown: z.object({
    skills: z.number().int().min(0).max(100),
    experience: z.number().int().min(0).max(100),
    location: z.number().int().min(0).max(100),
    salary: z.number().int().min(0).max(100),
  }),
  rationale: bilingual,
});
export type FitScoreOutput = z.infer<typeof fitScoreSchema>;

export function fitScorePrompt(input: {
  job: { titleEn: string; descriptionEn: string; skills: string[]; district: string | null };
  seeker: { headlineEn: string | null; skills: string[]; yearsExperience: string | null; district: string | null };
}): PromptSpec<FitScoreOutput> {
  return {
    task: 'fit_score',
    version: 1,
    system:
      'You score how well a job seeker fits a job. Be strict and evidence-based. ' +
      'Each sub-score and the overall score are integers 0-100.',
    prompt: JSON.stringify(input),
    schema: fitScoreSchema,
  };
}

// ── Gulf/local job title normalization (Haiku) ──────────────────────────
export const titleTranslationSchema = z.object({
  canonical: bilingual,
  categorySlug: z.string().nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
});
export type TitleTranslationOutput = z.infer<typeof titleTranslationSchema>;

export function gulfTitleTranslationPrompt(input: {
  sourceTitle: string;
  country: string | null;
}): PromptSpec<TitleTranslationOutput> {
  return {
    task: 'translate',
    version: 1,
    system:
      'Map a gulf/local job title to a canonical Kerala-job-market title in ' +
      'Malayalam and English plus a category slug. Return null slug if unknown.',
    prompt: JSON.stringify(input),
    schema: titleTranslationSchema,
  };
}

// ── Job posting cleanup / bilingual fill (Haiku) ────────────────────────
export const jobNormalizeSchema = z.object({
  title: bilingual,
  description: bilingual,
  skills: z.array(z.string()).max(30),
  categorySlug: z.string().nullable(),
});
export type JobNormalizeOutput = z.infer<typeof jobNormalizeSchema>;

export function jobNormalizePrompt(input: {
  titleEn: string;
  descriptionEn: string;
  titleMl?: string | null;
}): PromptSpec<JobNormalizeOutput> {
  return {
    task: 'extract',
    version: 1,
    system:
      'Clean and structure a raw job posting. Produce Malayalam and English ' +
      'title + description, extract a deduplicated skills list and a category ' +
      'slug. Do not invent salary, contact, or employer details.',
    prompt: JSON.stringify(input),
    schema: jobNormalizeSchema,
  };
}

// ── Registry of every prompt for introspection / eval harnesses ─────────
export const PROMPTS = {
  fitScore: fitScorePrompt,
  gulfTitleTranslation: gulfTitleTranslationPrompt,
  jobNormalize: jobNormalizePrompt,
} as const;

export type PromptName = keyof typeof PROMPTS;
