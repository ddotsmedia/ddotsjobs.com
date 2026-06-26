import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { computeFitScore, type FitScoreResult } from '@/lib/services/fit-score.service';
import { aiQueue } from '../queue.js';
import { protectedProcedure, roleProcedure, router } from '../trpc.js';

export const fitScoreRouter = router({
  getForJob: roleProcedure('seeker')
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const j = tables.jobs;
      const [job] = await ctx.db
        .select({
          district: j.district,
          category: j.categorySlug,
          minExperienceMonths: j.minExperienceMonths,
          salaryMinPaise: j.salaryMinPaise,
          salaryMaxPaise: j.salaryMaxPaise,
          salaryDisclosed: j.salaryDisclosed,
          languageRequirement: j.languageRequirement,
          requiredCertifications: j.requiredCertifications,
        })
        .from(j)
        .where(and(eq(j.id, input.jobId), isNull(j.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });

      // Cached score within 24h?
      const fs = tables.fitScores;
      const [cached] = await ctx.db
        .select({
          overall: fs.overallScore,
          qualification: fs.qualificationScore,
          experience: fs.experienceScore,
          location: fs.locationScore,
          salary: fs.salaryScore,
          language: fs.languageScore,
          certBonus: fs.certBonus,
          recommendation: fs.recommendation,
          explanationEn: fs.explanationEn,
          explanationMl: fs.explanationMl,
          computedAt: fs.computedAt,
        })
        .from(fs)
        .where(
          and(
            eq(fs.seekerUserId, ctx.user.id),
            eq(fs.jobId, input.jobId),
            isNull(fs.deletedAt),
            sql`${fs.computedAt} > now() - interval '24 hours'`,
            sql`${fs.overallScore} IS NOT NULL`,
          ),
        )
        .limit(1);

      if (cached && cached.overall != null) {
        return {
          overall: cached.overall,
          qualification: cached.qualification ?? 0,
          experience: cached.experience ?? 0,
          location: cached.location ?? 0,
          salary: cached.salary ?? 0,
          language: cached.language ?? 0,
          certBonus: cached.certBonus,
          recommendation: (cached.recommendation ?? 'consider') as FitScoreResult['recommendation'],
          explanationEn: cached.explanationEn,
          explanationMl: cached.explanationMl,
          cached: true as const,
        };
      }

      // Load seeker context.
      const sp = tables.seekerProfiles;
      const [seekerRow] = await ctx.db
        .select({
          totalExperienceMonths: sp.totalExperienceMonths,
          homeDistrict: sp.homeDistrict,
          salaryMinPaise: sp.expectedSalaryMinPaise,
          salaryMaxPaise: sp.expectedSalaryMaxPaise,
          preferredCategories: sp.preferredCategories,
          preferredLanguage: tables.users.preferredLanguage,
        })
        .from(sp)
        .innerJoin(tables.users, eq(tables.users.id, sp.userId))
        .where(eq(sp.userId, ctx.user.id))
        .limit(1);

      const regs = await ctx.db
        .select({ type: tables.professionalRegistrations.typeCode, status: tables.professionalRegistrations.statusCode })
        .from(tables.professionalRegistrations)
        .where(
          and(
            eq(tables.professionalRegistrations.userId, ctx.user.id),
            isNull(tables.professionalRegistrations.deletedAt),
          ),
        );

      const result = computeFitScore({
        seeker: {
          totalExperienceMonths: seekerRow?.totalExperienceMonths ?? 0,
          primaryDistrict: seekerRow?.homeDistrict ?? null,
          willingDistricts: [],
          salaryMinPaise: seekerRow?.salaryMinPaise ?? null,
          salaryMaxPaise: seekerRow?.salaryMaxPaise ?? null,
          preferredCategories: seekerRow?.preferredCategories ?? [],
          preferredLanguage: seekerRow?.preferredLanguage ?? 'ml',
          professionalRegistrations: regs.map((r) => ({
            type: r.type ?? '',
            verificationStatus: r.status,
          })),
        },
        job: {
          district: job.district ?? '',
          category: job.category ?? '',
          minExperienceMonths: job.minExperienceMonths ?? 0,
          maxExperienceMonths: null,
          salaryMinPaise: job.salaryMinPaise,
          salaryMaxPaise: job.salaryMaxPaise,
          salaryDisclosed: job.salaryDisclosed,
          languageRequirement: job.languageRequirement,
          requiredCertifications: job.requiredCertifications,
        },
      });

      const now = new Date();
      const [row] = await ctx.db
        .insert(fs)
        .values({
          jobId: input.jobId,
          seekerUserId: ctx.user.id,
          score: result.overall,
          overallScore: result.overall,
          qualificationScore: result.qualification,
          experienceScore: result.experience,
          locationScore: result.location,
          salaryScore: result.salary,
          languageScore: result.language,
          certBonus: result.certBonus,
          recommendation: result.recommendation,
          modelId: 'rule_based_v1',
          breakdown: {
            qualification: result.qualification,
            experience: result.experience,
            location: result.location,
            salary: result.salary,
            language: result.language,
          },
          computedAt: now,
        })
        .onConflictDoUpdate({
          target: [fs.jobId, fs.seekerUserId],
          targetWhere: isNull(fs.deletedAt),
          set: {
            score: result.overall,
            overallScore: result.overall,
            qualificationScore: result.qualification,
            experienceScore: result.experience,
            locationScore: result.location,
            salaryScore: result.salary,
            languageScore: result.language,
            certBonus: result.certBonus,
            recommendation: result.recommendation,
            computedAt: now,
            updatedAt: now,
          },
        })
        .returning({ id: fs.id });

      // Non-blocking AI explanation.
      if (row) {
        await aiQueue.add(
          'fit.explain_score',
          {
            fitResult: result,
            jobCategory: job.category,
            seekerLanguage: seekerRow?.preferredLanguage ?? 'ml',
            fitScoreId: row.id,
          },
          { attempts: 2, backoff: { type: 'exponential', delay: 5_000 } },
        );
      }

      return { ...result, explanationEn: null, explanationMl: null, cached: false as const };
    }),

  getTopCandidates: roleProcedure('employer')
    .input(z.object({ jobId: z.string().uuid(), limit: z.number().int().min(1).max(50).default(15) }))
    .query(async ({ ctx, input }) => {
      // Verify the job belongs to this employer.
      const [owned] = await ctx.db
        .select({ id: tables.jobs.id })
        .from(tables.jobs)
        .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
        .where(and(eq(tables.jobs.id, input.jobId), eq(tables.employers.ownerUserId, ctx.user.id)))
        .limit(1);
      if (!owned) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });

      const fs = tables.fitScores;
      return ctx.db
        .select({
          userId: fs.seekerUserId,
          overallScore: fs.overallScore,
          recommendation: fs.recommendation,
          fullName: tables.users.nameEn,
          currentDistrict: tables.seekerProfiles.currentDistrict,
          totalExperienceMonths: tables.seekerProfiles.totalExperienceMonths,
          isVerifiedProfessional: tables.users.isVerifiedProfessional,
        })
        .from(fs)
        .innerJoin(tables.users, eq(tables.users.id, fs.seekerUserId))
        .leftJoin(tables.seekerProfiles, eq(tables.seekerProfiles.userId, fs.seekerUserId))
        .where(and(eq(fs.jobId, input.jobId), isNull(fs.deletedAt)))
        .orderBy(desc(fs.overallScore))
        .limit(input.limit);
    }),

  invalidateForUser: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(tables.fitScores).where(eq(tables.fitScores.seekerUserId, ctx.user.id));
    return { success: true as const };
  }),
});
