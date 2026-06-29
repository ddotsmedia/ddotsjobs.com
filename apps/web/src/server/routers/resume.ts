import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, tables } from '@ddotsjobs/db';
import { callAI } from '@ddotsjobs/ai';
import { resumeGenerateKeralaCvPrompt, resumeSummaryPrompt } from '@ddotsjobs/ai/prompts';
import { roleProcedure, router } from '../trpc.js';
import { rateLimit } from '../rate-limit.js';
import { assertAiEnabled } from '@/lib/site-settings';

const seekerProc = roleProcedure('seeker');

const TEMPLATES = ['kerala-classic', 'modern-minimal', 'gulf-ready'] as const;
const experienceItem = z.object({
  company: z.string().max(160),
  role: z.string().max(160),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  description: z.string().max(1200).optional(),
});
const educationItem = z.object({ institution: z.string().max(160), degree: z.string().max(160), year: z.string().max(20).optional() });
const certItem = z.object({ name: z.string().max(160), issuer: z.string().max(160).optional(), year: z.string().max(20).optional() });
const resumeFields = z.object({
  title: z.string().max(160).optional(),
  summary: z.string().max(2000).optional(),
  experience: z.array(experienceItem).max(20).optional(),
  education: z.array(educationItem).max(15).optional(),
  skills: z.array(z.string().max(60)).max(50).optional(),
  languages: z.array(z.string().max(40)).max(15).optional(),
  certifications: z.array(certItem).max(20).optional(),
  templateId: z.enum(TEMPLATES).optional(),
  isPublic: z.boolean().optional(),
});

export const resumeRouter = router({
  generate: seekerProc.mutation(async ({ ctx }) => {
    await assertAiEnabled();
    await rateLimit(ctx.redis, `resume:${ctx.user.id}`, 10, 86_400);
    const [u] = await ctx.db
      .select({ nameEn: tables.users.nameEn, nameMl: tables.users.nameMl, primaryProfession: tables.users.primaryProfession })
      .from(tables.users)
      .where(eq(tables.users.id, ctx.user.id))
      .limit(1);

    const [p] = await ctx.db
      .select({
        completionPct: tables.seekerProfiles.completionPct,
        currentDistrict: tables.seekerProfiles.currentDistrict,
        totalExperienceMonths: tables.seekerProfiles.totalExperienceMonths,
        preferredCategories: tables.seekerProfiles.preferredCategories,
        salaryMin: tables.seekerProfiles.expectedSalaryMinPaise,
        salaryMax: tables.seekerProfiles.expectedSalaryMaxPaise,
      })
      .from(tables.seekerProfiles)
      .where(eq(tables.seekerProfiles.userId, ctx.user.id))
      .limit(1);

    if (!p) throw new TRPCError({ code: 'FORBIDDEN', message: 'Complete your profile first' });
    if ((p.completionPct ?? 0) < 60) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Profile must be at least 60% complete to generate a resume' });
    }

    const certRows = await ctx.db
      .select({ code: tables.professionalRegistrations.typeCode })
      .from(tables.professionalRegistrations)
      .where(and(eq(tables.professionalRegistrations.userId, ctx.user.id), eq(tables.professionalRegistrations.status, 'verified'), isNull(tables.professionalRegistrations.deletedAt)));

    const spec = resumeGenerateKeralaCvPrompt({
      fullName: u?.nameEn ?? 'Candidate',
      fullNameMl: u?.nameMl ?? null,
      primaryProfession: u?.primaryProfession ?? null,
      district: p.currentDistrict,
      totalExperienceMonths: p.totalExperienceMonths ?? 0,
      preferredCategories: p.preferredCategories ?? [],
      verifiedCerts: certRows.map((c) => c.code).filter((c): c is string => Boolean(c)),
      salaryMin: p.salaryMin,
      salaryMax: p.salaryMax,
    });
    const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
    return data;
  }),

  // ── Resume builder CRUD (JS1) ────────────────────────────────────────
  getByUser: seekerProc.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(tables.resumeProfiles)
      .where(eq(tables.resumeProfiles.userId, ctx.user.id))
      .orderBy(desc(tables.resumeProfiles.updatedAt));
  }),

  create: seekerProc.input(resumeFields).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .insert(tables.resumeProfiles)
      .values({
        userId: ctx.user.id,
        title: input.title ?? null,
        summary: input.summary ?? null,
        experience: input.experience ?? [],
        education: input.education ?? [],
        skills: input.skills ?? [],
        languages: input.languages ?? [],
        certifications: input.certifications ?? [],
        templateId: input.templateId ?? 'kerala-classic',
        isPublic: input.isPublic ?? false,
      })
      .returning({ id: tables.resumeProfiles.id });
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return { id: row.id };
  }),

  update: seekerProc
    .input(resumeFields.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const set: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) set[k] = v;
      const res = await ctx.db
        .update(tables.resumeProfiles)
        .set(set)
        .where(and(eq(tables.resumeProfiles.id, id), eq(tables.resumeProfiles.userId, ctx.user.id)))
        .returning({ id: tables.resumeProfiles.id });
      if (res.length === 0) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true as const };
    }),

  export: seekerProc.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select()
      .from(tables.resumeProfiles)
      .where(and(eq(tables.resumeProfiles.id, input.id), eq(tables.resumeProfiles.userId, ctx.user.id)))
      .limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  // AI: enhance summary or an experience description.
  generateSummary: seekerProc
    .input(z.object({ mode: z.enum(['summary', 'experience']), draft: z.string().max(1500), title: z.string().max(160).optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAiEnabled();
      await rateLimit(ctx.redis, `resumeai:${ctx.user.id}`, 30, 86_400);
      const [u] = await ctx.db
        .select({ profession: tables.users.primaryProfession })
        .from(tables.users)
        .where(eq(tables.users.id, ctx.user.id))
        .limit(1);
      const [p] = await ctx.db
        .select({ months: tables.seekerProfiles.totalExperienceMonths })
        .from(tables.seekerProfiles)
        .where(eq(tables.seekerProfiles.userId, ctx.user.id))
        .limit(1);
      const spec = resumeSummaryPrompt({
        mode: input.mode,
        title: input.title,
        profession: u?.profession ?? undefined,
        experienceYears: p?.months ? Math.floor(p.months / 12) : undefined,
        draft: input.draft,
      });
      const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
      return data;
    }),
});
