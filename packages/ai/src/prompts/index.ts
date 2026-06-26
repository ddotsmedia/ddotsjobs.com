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

// ── PSC notification extraction (Haiku) ─────────────────────────────────
export const pscNotificationSchema = z.object({
  categoryNo: z.string().min(1),
  postName: z.string().min(1),
  department: z.string().nullable(),
  totalVacancies: z.number().int().nonnegative().nullable(),
  qualificationText: z.string().nullable(),
  scaleOfPay: z.string().nullable(),
  applicationEnd: z.string().nullable(), // ISO date or null
  examDate: z.string().nullable(), // ISO date or null
  status: z.enum(['active', 'exam_scheduled', 'rank_list', 'closed']),
  sourceUrl: z.string().nullable(),
});
export const pscExtractSchema = z.object({
  notifications: z.array(pscNotificationSchema).max(200),
});
export type PscExtractOutput = z.infer<typeof pscExtractSchema>;
export type PscNotification = z.infer<typeof pscNotificationSchema>;

export function pscExtractNotificationPrompt(input: {
  html: string;
}): PromptSpec<PscExtractOutput> {
  return {
    task: 'extract',
    version: 1,
    system:
      'Extract Kerala PSC notifications from the provided HTML. Return one entry ' +
      'per notification. categoryNo is the official category number. Dates must be ' +
      'ISO-8601 (YYYY-MM-DD) or null. status: active (open), exam_scheduled, ' +
      'rank_list (list published), closed. Never invent data — use null when a ' +
      'field is absent.',
    prompt: input.html,
    schema: pscExtractSchema,
  };
}

// ── PSC Malayalam post-name summary (Haiku) ─────────────────────────────
export const pscSummaryMlSchema = z.object({ postNameMl: z.string().min(1) });
export type PscSummaryMlOutput = z.infer<typeof pscSummaryMlSchema>;

export function pscGenerateSummaryMlPrompt(input: {
  postName: string;
  department: string | null;
}): PromptSpec<PscSummaryMlOutput> {
  return {
    task: 'translate',
    version: 1,
    system:
      'Translate the PSC post name into natural Malayalam (postNameMl). Keep it ' +
      'concise and faithful; do not add commentary.',
    prompt: JSON.stringify(input),
    schema: pscSummaryMlSchema,
  };
}

// ── Gulf → Kerala job-title translation (Haiku) ─────────────────────────
export const gulfTranslateSchema = z.object({
  kerala_titles: z.array(z.string()).min(1).max(8),
  primary_title: z.string().min(1),
  explanation_ml: z.string(),
  suggested_categories: z.array(z.string()).max(8),
  confidence: z.number().min(0).max(1),
});
export type GulfTranslateOutput = z.infer<typeof gulfTranslateSchema>;

export function gulfTranslateTitlePrompt(input: {
  gulfTitle: string;
  country: string | null;
  industry: string | null;
  yearsExp: number | null;
}): PromptSpec<GulfTranslateOutput> {
  return {
    task: 'translate',
    version: 1,
    system:
      'Map a Gulf job title to its Kerala job-market equivalents. Return ' +
      'kerala_titles (ranked English titles), primary_title (best match), ' +
      'explanation_ml (one Malayalam sentence), suggested_categories (slugs like ' +
      'nursing/it/construction), and confidence 0..1. Be faithful; do not inflate ' +
      'seniority.',
    prompt: JSON.stringify(input),
    schema: gulfTranslateSchema,
  };
}

// ── Registry of every prompt for introspection / eval harnesses ─────────
export const PROMPTS = {
  fitScore: fitScorePrompt,
  gulfTitleTranslation: gulfTitleTranslationPrompt,
  gulfTranslateTitle: gulfTranslateTitlePrompt,
  jobNormalize: jobNormalizePrompt,
  pscExtractNotification: pscExtractNotificationPrompt,
  pscGenerateSummaryMl: pscGenerateSummaryMlPrompt,
} as const;

export type PromptName = keyof typeof PROMPTS;
