import { TRPCError } from '@trpc/server';
import { and, eq, isNull, tables } from '@ddotsjobs/db';
import { callAI } from '@ddotsjobs/ai';
import { resumeGenerateKeralaCvPrompt } from '@ddotsjobs/ai/prompts';
import { roleProcedure, router } from '../trpc.js';

const seekerProc = roleProcedure('seeker');

export const resumeRouter = router({
  generate: seekerProc.mutation(async ({ ctx }) => {
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
});
