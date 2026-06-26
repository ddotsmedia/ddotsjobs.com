import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, eq, isNull, tables } from '@ddotsjobs/db';
import { NORKA_FALLBACK } from '@/lib/norka';
import { aiQueue } from '../queue.js';
import { protectedProcedure, publicProcedure, roleProcedure, router } from '../trpc.js';

const GULF_COUNTRIES = ['uae', 'saudi_arabia', 'qatar', 'kuwait', 'oman', 'bahrain'] as const;
const DISTRICTS = [
  'thiruvananthapuram', 'kollam', 'pathanamthitta', 'alappuzha', 'kottayam',
  'idukki', 'ernakulam', 'thrissur', 'palakkad', 'malappuram', 'kozhikode',
  'wayanad', 'kannur', 'kasaragod',
] as const;
const URGENCY = ['immediate', 'within_60_days', 'moderate', 'flexible'] as const;

export const pravasiRouter = router({
  createProfile: roleProcedure('seeker')
    .input(
      z.object({
        totalYearsAbroad: z.number().int().min(1).max(50),
        primaryCountry: z.enum(GULF_COUNTRIES),
        returnDate: z.string().optional(),
        financialUrgency: z.enum(URGENCY).default('moderate'),
        norkaId: z.string().max(60).optional(),
        seekingEmploymentIn: z.array(z.enum(DISTRICTS)).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const t = tables.pravasiProfiles;
      const returnedAt = input.returnDate ? new Date(input.returnDate) : null;
      await ctx.db
        .insert(t)
        .values({
          userId: ctx.user.id,
          currentCountry: input.primaryCountry,
          isReturnee: true,
          returnedAt: returnedAt && !Number.isNaN(returnedAt.getTime()) ? returnedAt : null,
          totalYearsAbroad: input.totalYearsAbroad,
          financialUrgency: input.financialUrgency,
          norkaIdMasked: input.norkaId ?? null,
          seekingEmploymentIn: input.seekingEmploymentIn ?? [],
        })
        .onConflictDoUpdate({
          target: t.userId,
          set: {
            currentCountry: input.primaryCountry,
            isReturnee: true,
            returnedAt: returnedAt && !Number.isNaN(returnedAt.getTime()) ? returnedAt : null,
            totalYearsAbroad: input.totalYearsAbroad,
            financialUrgency: input.financialUrgency,
            norkaIdMasked: input.norkaId ?? null,
            seekingEmploymentIn: input.seekingEmploymentIn ?? [],
            updatedAt: new Date(),
          },
        });
      return { success: true as const };
    }),

  addWorkHistory: protectedProcedure
    .input(
      z.object({
        country: z.enum(GULF_COUNTRIES),
        employerName: z.string().max(255).optional(),
        gulfJobTitle: z.string().min(2).max(255),
        industry: z.string().max(120).optional(),
        yearsInRole: z.number().int().min(1).max(40),
        keySkills: z.array(z.string().max(60)).default([]),
        certifications: z.array(z.string().max(120)).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select({ id: tables.pravasiProfiles.id })
        .from(tables.pravasiProfiles)
        .where(
          and(
            eq(tables.pravasiProfiles.userId, ctx.user.id),
            isNull(tables.pravasiProfiles.deletedAt),
          ),
        )
        .limit(1);
      if (!profile) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Create your profile first' });
      }

      const [row] = await ctx.db
        .insert(tables.pravasiWorkHistory)
        .values({
          pravasiProfileId: profile.id,
          userId: ctx.user.id,
          country: input.country,
          employerName: input.employerName ?? null,
          gulfJobTitle: input.gulfJobTitle,
          titleLocal: input.gulfJobTitle,
          industry: input.industry ?? null,
          yearsInRole: input.yearsInRole,
          keySkills: input.keySkills,
          certifications: input.certifications,
        })
        .returning({ id: tables.pravasiWorkHistory.id });

      if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Trigger async gulf->Kerala title translation.
      await aiQueue.add('gulf.translate', {
        workHistoryId: row.id,
        userId: ctx.user.id,
        gulfTitle: input.gulfJobTitle,
        country: input.country,
        industry: input.industry ?? null,
        yearsExp: input.yearsInRole,
      });

      return { id: row.id };
    }),

  getTranslations: protectedProcedure.query(async ({ ctx }) => {
    const t = tables.pravasiWorkHistory;
    return ctx.db
      .select({
        id: t.id,
        country: t.country,
        employerName: t.employerName,
        gulfJobTitle: t.gulfJobTitle,
        industry: t.industry,
        yearsInRole: t.yearsInRole,
        keySkills: t.keySkills,
        certifications: t.certifications,
        translatedKeralaTitles: t.translatedKeralaTitles,
        translationConfidence: t.translationConfidence,
        translationSource: t.translationSource,
      })
      .from(t)
      .where(and(eq(t.userId, ctx.user.id), isNull(t.deletedAt)))
      .orderBy(asc(t.sortOrder), asc(t.createdAt));
  }),

  confirmTranslation: protectedProcedure
    .input(
      z.object({
        workHistoryId: z.string().uuid(),
        confirmedTitles: z.array(z.string().max(255)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tables.pravasiWorkHistory)
        .set({
          translatedKeralaTitles: input.confirmedTitles,
          translationSource: 'user_confirmed',
        })
        .where(
          and(
            eq(tables.pravasiWorkHistory.id, input.workHistoryId),
            eq(tables.pravasiWorkHistory.userId, ctx.user.id), // security guard
          ),
        );
      return { success: true as const };
    }),

  norkaSchemes: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        slug: tables.norkaSchemes.slug,
        name: tables.norkaSchemes.titleEn,
        nameMl: tables.norkaSchemes.titleMl,
        benefitType: tables.norkaSchemes.benefitType,
        maxBenefitPaise: tables.norkaSchemes.maxBenefitPaise,
        descriptionEn: tables.norkaSchemes.summaryEn,
        descriptionMl: tables.norkaSchemes.summaryMl,
        documents: tables.norkaSchemes.documents,
        applyUrl: tables.norkaSchemes.applyUrl,
      })
      .from(tables.norkaSchemes)
      .where(
        and(eq(tables.norkaSchemes.isActive, true), isNull(tables.norkaSchemes.deletedAt)),
      );

    if (rows.length > 0) return rows;

    // Fallback when the table has not been seeded.
    return NORKA_FALLBACK.map((s) => ({
      slug: s.slug,
      name: s.name,
      nameMl: null as string | null,
      benefitType: s.benefitType,
      maxBenefitPaise: s.maxBenefitPaise,
      descriptionEn: s.descriptionEn,
      descriptionMl: s.descriptionMl,
      documents: s.documents,
      applyUrl: s.applyUrl,
    }));
  }),
});
