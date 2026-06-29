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

// ── KNMC / professional certificate extraction (Haiku) ──────────────────
export const knmcExtractSchema = z.object({
  registration_number: z.string().nullable(),
  full_name: z.string().nullable(),
  issue_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
  is_valid_format: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type KnmcExtractOutput = z.infer<typeof knmcExtractSchema>;

export function knmcExtractCertificatePrompt(input: {
  pdfText: string;
}): PromptSpec<KnmcExtractOutput> {
  return {
    task: 'extract',
    version: 1,
    system:
      'Extract fields from a Kerala professional-registration certificate ' +
      '(nurses/teachers/medical/pharmacy councils). Return registration_number, ' +
      'full_name, issue_date, expiry_date (ISO or null), is_valid_format (does the ' +
      'document look like a genuine council certificate), and confidence 0..1. ' +
      'Never invent values — use null when absent.',
    prompt: input.pdfText,
    schema: knmcExtractSchema,
  };
}

// ── Fit-score explanation (Flash) ───────────────────────────────────────
export const fitExplainSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()).max(6),
  gaps: z.array(z.string()).max(6),
  action: z.string(),
});
export type FitExplainOutput = z.infer<typeof fitExplainSchema>;

export function fitExplainScorePrompt(input: {
  overallScore: number;
  qualificationScore: number;
  experienceScore: number;
  locationScore: number;
  salaryScore: number;
  jobCategory: string;
  seekerLanguage: string;
  hasRequiredCert: boolean;
  missingCerts: string[];
}): PromptSpec<FitExplainOutput> {
  const lang = input.seekerLanguage === 'ml' ? 'Malayalam' : 'English';
  return {
    task: 'reasoning',
    version: 1,
    system:
      `Explain a job fit score to a job seeker in ${lang}. Be encouraging and ` +
      'concrete. summary: one short paragraph. strengths/gaps: short bullet ' +
      'phrases. action: one next step. Base it ONLY on the provided scores.',
    prompt: JSON.stringify(input),
    schema: fitExplainSchema,
  };
}

// ── Job description auto-fill (Flash) ───────────────────────────────────
export const jobAutoFillSchema = z.object({
  description_en: z.string(),
  description_ml: z.string(),
});
export type JobAutoFillOutput = z.infer<typeof jobAutoFillSchema>;

export function jobAutoFillDescriptionPrompt(input: {
  title: string;
  category: string;
  district: string;
  language: string;
}): PromptSpec<JobAutoFillOutput> {
  return {
    task: 'summarize',
    version: 1,
    system:
      'Write a concise, professional job description (4-7 sentences) for the ' +
      'given Kerala job, in both English (description_en) and Malayalam ' +
      '(description_ml). Cover role, key responsibilities and who should apply. ' +
      'Do not invent salary, contact or employer-specific claims.',
    prompt: JSON.stringify(input),
    schema: jobAutoFillSchema,
  };
}

// ── Walk-in notice (Flash) ──────────────────────────────────────────────
export const walkinNoticeSchema = z.object({ notice: z.string().min(1) });
export type WalkinNoticeOutput = z.infer<typeof walkinNoticeSchema>;

export function walkinGenerateNoticePrompt(input: {
  jobTitle: string;
  jobTitleMl: string | null;
  companyName: string;
  district: string;
  walkInDate: string;
  walkInTime: string;
  venue: string;
  salaryRange: string;
  requirements: string[];
  contactPhone: string | null;
  language: string;
}): PromptSpec<WalkinNoticeOutput> {
  const lang = input.language === 'en' ? 'English' : 'Malayalam';
  return {
    task: 'summarize',
    version: 1,
    system:
      `Write a ready-to-share WhatsApp walk-in interview notice in ${lang}. ` +
      'Use clear lines and a few relevant emojis (📅 📍 🕒 💼 📞). Include the ' +
      'company, role, date, time, venue, salary, required documents and contact. ' +
      'Return the full notice as `notice`. Use ONLY the data provided.',
    prompt: JSON.stringify(input),
    schema: walkinNoticeSchema,
  };
}

// ── Interview prep (Pro) ────────────────────────────────────────────────
export const interviewQuestionsSchema = z.object({
  common_questions: z.array(z.string()),
  technical_questions: z.array(z.string()),
  malayalam_questions: z.array(z.string()),
  tips: z.array(z.string()),
  tips_ml: z.array(z.string()),
  dress_code: z.string(),
  documents_to_bring: z.array(z.string()),
});
export type InterviewQuestionsOutput = z.infer<typeof interviewQuestionsSchema>;

export function interviewGenerateQuestionsPrompt(input: {
  jobTitle: string;
  category: string;
  employerType: string;
  language: string;
}): PromptSpec<InterviewQuestionsOutput> {
  return {
    task: 'reasoning',
    version: 1,
    system:
      'You are an interview coach for Kerala job seekers. For the given role, return: ' +
      '5 common_questions, 5 technical_questions, 3 malayalam_questions (in Malayalam), ' +
      '3 tips and 3 tips_ml (Malayalam), a short dress_code line, and documents_to_bring ' +
      '(typical for Kerala interviews: resume copies, ID proof, certificates). Be specific ' +
      'to the role and realistic for Kerala employers.',
    prompt: JSON.stringify(input),
    schema: interviewQuestionsSchema,
  };
}

// ── Cover letter (Pro) ──────────────────────────────────────────────────
export const coverLetterSchema = z.object({ cover_letter: z.string().min(1) });
export type CoverLetterOutput = z.infer<typeof coverLetterSchema>;

export function applicationCoverLetterPrompt(input: {
  seekerName: string;
  seekerProfession: string;
  totalExperienceMonths: number;
  jobTitle: string;
  companyName: string;
  district: string;
  employerQuestion: string | null;
  language: string;
}): PromptSpec<CoverLetterOutput> {
  const lang = input.language === 'ml' ? 'Malayalam' : 'English';
  return {
    task: 'reasoning',
    version: 1,
    system:
      `Write a concise, sincere cover letter (120-180 words) in ${lang} for this Kerala ` +
      'job application. First person, specific to the role, no clichés or invented facts. ' +
      'If an employer question is provided, address it. Return as `cover_letter`.',
    prompt: JSON.stringify(input),
    schema: coverLetterSchema,
  };
}

// ── Resume / CV generator (Pro) ─────────────────────────────────────────
export const resumeGenerateSchema = z.object({
  summary: z.string(),
  summary_ml: z.string(),
  skills: z.array(z.string()),
  experience_placeholder: z.string(),
  education_placeholder: z.string(),
  certifications: z.array(z.string()),
  strengths: z.array(z.string()),
});
export type ResumeGenerateOutput = z.infer<typeof resumeGenerateSchema>;

export function resumeGenerateKeralaCvPrompt(input: {
  fullName: string;
  fullNameMl: string | null;
  primaryProfession: string | null;
  district: string | null;
  totalExperienceMonths: number;
  preferredCategories: string[];
  verifiedCerts: string[];
  salaryMin: number | null;
  salaryMax: number | null;
}): PromptSpec<ResumeGenerateOutput> {
  return {
    task: 'reasoning',
    version: 1,
    system:
      'Draft a professional CV skeleton for a Kerala job seeker from the structured data. ' +
      'Return: summary (3-4 sentences, professional) + summary_ml (Malayalam), skills[], ' +
      'experience_placeholder (a fill-in template line), education_placeholder, ' +
      'certifications[] (include any provided verified certs), strengths[]. ' +
      'Never fabricate employers, dates or qualifications — use placeholders the user edits.',
    prompt: JSON.stringify(input),
    schema: resumeGenerateSchema,
  };
}

// ── Smart search NL parser (Flash) ──────────────────────────────────────
export const smartSearchSchema = z.object({
  category: z.string().nullable(),
  district: z.string().nullable(),
  salaryMin: z.number().nullable(),
  jobType: z.string().nullable(),
  isWalkIn: z.boolean().nullable(),
  valuesGulfExperience: z.boolean().nullable(),
  confidence: z.number(),
});
export type SmartSearchOutput = z.infer<typeof smartSearchSchema>;

export function searchParseNaturalLanguagePrompt(input: {
  query: string;
  availableCategories: string[];
  availableDistricts: string[];
}): PromptSpec<SmartSearchOutput> {
  return {
    task: 'extract',
    version: 1,
    system:
      'Parse a Kerala job-search query into structured filters. Map to the provided ' +
      'availableCategories and availableDistricts slugs only (else null). salaryMin in ' +
      'rupees/month (number) or null. jobType one of full_time|part_time|contract|walk_in| ' +
      'internship or null. isWalkIn/valuesGulfExperience booleans or null. confidence 0-1 ' +
      '(how sure the parse is). Return null for anything not clearly stated.',
    prompt: JSON.stringify(input),
    schema: smartSearchSchema,
  };
}

// ── Job-post AI helpers (Flash) ─────────────────────────────────────────
export const suggestTitlesSchema = z.object({ titles: z.array(z.string()).max(8) });
export type SuggestTitlesOutput = z.infer<typeof suggestTitlesSchema>;
export function jobSuggestTitlesPrompt(input: { partialTitle: string; category: string }): PromptSpec<SuggestTitlesOutput> {
  return {
    task: 'classify',
    version: 1,
    system:
      'Suggest 5 clear, specific Kerala job titles for the given category and partial text. ' +
      'Real roles employers use (e.g. "Staff Nurse — ICU", "Civil Site Engineer"). Return as titles[].',
    prompt: JSON.stringify(input),
    schema: suggestTitlesSchema,
  };
}

export const suggestSkillsSchema = z.object({ skills: z.array(z.string()).max(15) });
export type SuggestSkillsOutput = z.infer<typeof suggestSkillsSchema>;
export function jobSuggestSkillsPrompt(input: { title: string; category: string }): PromptSpec<SuggestSkillsOutput> {
  return {
    task: 'classify',
    version: 1,
    system: 'List up to 10 concrete skills employers expect for this Kerala role. Short noun phrases. Return as skills[].',
    prompt: JSON.stringify(input),
    schema: suggestSkillsSchema,
  };
}

export const salaryBenchmarkSchema = z.object({
  min: z.number(),
  max: z.number(),
  median: z.number(),
  confidence: z.enum(['low', 'medium', 'high']),
  sampleSize: z.number(),
});
export type SalaryBenchmarkOutput = z.infer<typeof salaryBenchmarkSchema>;
export function salaryBenchmarkPrompt(input: { category: string; district: string; experienceMin: number }): PromptSpec<SalaryBenchmarkOutput> {
  return {
    task: 'reasoning',
    version: 1,
    system:
      'Estimate the realistic MONTHLY salary band in RUPEES for this Kerala role/district/experience, ' +
      'using Kerala market knowledge (2026). Return min, max, median (rupees, integers), confidence ' +
      '(low|medium|high), and a plausible sampleSize. Be realistic — Kerala pay, not metro India.',
    prompt: JSON.stringify(input),
    schema: salaryBenchmarkSchema,
  };
}

// ── Registry of every prompt for introspection / eval harnesses ─────────
export const PROMPTS = {
  fitScore: fitScorePrompt,
  fitExplainScore: fitExplainScorePrompt,
  jobAutoFillDescription: jobAutoFillDescriptionPrompt,
  walkinGenerateNotice: walkinGenerateNoticePrompt,
  gulfTitleTranslation: gulfTitleTranslationPrompt,
  gulfTranslateTitle: gulfTranslateTitlePrompt,
  jobNormalize: jobNormalizePrompt,
  knmcExtractCertificate: knmcExtractCertificatePrompt,
  pscExtractNotification: pscExtractNotificationPrompt,
  pscGenerateSummaryMl: pscGenerateSummaryMlPrompt,
  interviewGenerateQuestions: interviewGenerateQuestionsPrompt,
  applicationCoverLetter: applicationCoverLetterPrompt,
  resumeGenerateKeralaCv: resumeGenerateKeralaCvPrompt,
  searchParseNaturalLanguage: searchParseNaturalLanguagePrompt,
  jobSuggestTitles: jobSuggestTitlesPrompt,
  jobSuggestSkills: jobSuggestSkillsPrompt,
  salaryBenchmark: salaryBenchmarkPrompt,
} as const;

export type PromptName = keyof typeof PROMPTS;
