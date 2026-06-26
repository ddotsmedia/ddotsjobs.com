import { z } from 'zod';
import { and, eq, isNull, tables } from '@ddotsjobs/db';
import { protectedProcedure, roleProcedure, router } from '../trpc.js';

const DISTRICTS = [
  'thiruvananthapuram', 'kollam', 'pathanamthitta', 'alappuzha', 'kottayam',
  'idukki', 'ernakulam', 'thrissur', 'palakkad', 'malappuram', 'kozhikode',
  'wayanad', 'kannur', 'kasaragod',
] as const;

const updateInput = z.object({
  fullName: z.string().min(2).max(255).optional(),
  fullNameMl: z.string().max(255).optional(),
  primaryDistrict: z.enum(DISTRICTS).optional(),
  primaryProfession: z.string().max(80).optional(),
  preferredLanguage: z.enum(['ml', 'en']).optional(),
  totalExperienceMonths: z.number().int().min(0).optional(),
  currentEmployer: z.string().max(255).optional(),
  salaryMinPaise: z.number().int().min(0).optional(),
  salaryMaxPaise: z.number().int().min(0).optional(),
  preferredCategories: z.array(z.string().max(60)).optional(),
  preferredJobTypes: z.array(z.string().max(40)).optional(),
  visibility: z.enum(['private', 'selective', 'open']).optional(),
  contactViaPlatformOnly: z.boolean().optional(),
  showCurrentEmployer: z.boolean().optional(),
  isOpenToWork: z.boolean().optional(),
});

function computeCompletion(p: {
  nameEn: string | null;
  homeDistrict: string | null;
  primaryProfession: string | null;
  totalExperienceMonths: number | null;
  salaryMin: number | null;
  visibility: string | null;
  preferredCategories: string[];
}): number {
  let pct = 0;
  if (p.nameEn) pct += 20;
  if (p.homeDistrict) pct += 15;
  if (p.primaryProfession) pct += 15;
  if ((p.totalExperienceMonths ?? 0) > 0) pct += 15;
  if ((p.salaryMin ?? 0) > 0) pct += 15;
  if (p.visibility) pct += 10;
  if (p.preferredCategories.length > 0) pct += 10;
  return pct;
}

export const seekerRouter = router({
  updateProfile: roleProcedure('seeker')
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const uid = ctx.user.id;

      // 1. users
      const userSet: Record<string, unknown> = {};
      if (input.fullName !== undefined) userSet.nameEn = input.fullName;
      if (input.fullNameMl !== undefined) userSet.nameMl = input.fullNameMl;
      if (input.primaryDistrict !== undefined) userSet.primaryDistrict = input.primaryDistrict;
      if (input.primaryProfession !== undefined) userSet.primaryProfession = input.primaryProfession;
      if (input.preferredLanguage !== undefined) userSet.preferredLanguage = input.preferredLanguage;
      if (Object.keys(userSet).length > 0) {
        userSet.updatedAt = new Date();
        await ctx.db.update(tables.users).set(userSet).where(eq(tables.users.id, uid));
      }

      // 2. seeker_profiles upsert
      const profSet: Record<string, unknown> = {};
      if (input.primaryDistrict !== undefined) profSet.homeDistrict = input.primaryDistrict;
      if (input.totalExperienceMonths !== undefined) profSet.totalExperienceMonths = input.totalExperienceMonths;
      if (input.currentEmployer !== undefined) profSet.currentEmployer = input.currentEmployer;
      if (input.salaryMinPaise !== undefined) profSet.expectedSalaryMinPaise = input.salaryMinPaise;
      if (input.salaryMaxPaise !== undefined) profSet.expectedSalaryMaxPaise = input.salaryMaxPaise;
      if (input.preferredCategories !== undefined) profSet.preferredCategories = input.preferredCategories;
      if (input.preferredJobTypes !== undefined) profSet.preferredJobTypes = input.preferredJobTypes;
      if (input.visibility !== undefined) profSet.visibility = input.visibility;
      if (input.contactViaPlatformOnly !== undefined) profSet.contactViaPlatformOnly = input.contactViaPlatformOnly;
      if (input.showCurrentEmployer !== undefined) profSet.showCurrentEmployer = input.showCurrentEmployer;
      if (input.isOpenToWork !== undefined) profSet.isOpenToWork = input.isOpenToWork;

      await ctx.db
        .insert(tables.seekerProfiles)
        .values({ userId: uid, ...profSet })
        .onConflictDoUpdate({
          target: tables.seekerProfiles.userId,
          set: { ...profSet, updatedAt: new Date() },
        });

      // 3. recompute completion
      const [row] = await ctx.db
        .select({
          nameEn: tables.users.nameEn,
          primaryProfession: tables.users.primaryProfession,
          homeDistrict: tables.seekerProfiles.homeDistrict,
          totalExperienceMonths: tables.seekerProfiles.totalExperienceMonths,
          salaryMin: tables.seekerProfiles.expectedSalaryMinPaise,
          visibility: tables.seekerProfiles.visibility,
          preferredCategories: tables.seekerProfiles.preferredCategories,
        })
        .from(tables.seekerProfiles)
        .innerJoin(tables.users, eq(tables.users.id, tables.seekerProfiles.userId))
        .where(eq(tables.seekerProfiles.userId, uid))
        .limit(1);

      const pct = row ? computeCompletion(row) : 0;
      await ctx.db
        .update(tables.seekerProfiles)
        .set({ completionPct: pct, profileComplete: pct >= 100 })
        .where(eq(tables.seekerProfiles.userId, uid));

      return { completionPct: pct };
    }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        userId: tables.seekerProfiles.userId,
        homeDistrict: tables.seekerProfiles.homeDistrict,
        totalExperienceMonths: tables.seekerProfiles.totalExperienceMonths,
        currentEmployer: tables.seekerProfiles.currentEmployer,
        salaryMinPaise: tables.seekerProfiles.expectedSalaryMinPaise,
        salaryMaxPaise: tables.seekerProfiles.expectedSalaryMaxPaise,
        preferredCategories: tables.seekerProfiles.preferredCategories,
        preferredJobTypes: tables.seekerProfiles.preferredJobTypes,
        visibility: tables.seekerProfiles.visibility,
        contactViaPlatformOnly: tables.seekerProfiles.contactViaPlatformOnly,
        showCurrentEmployer: tables.seekerProfiles.showCurrentEmployer,
        isOpenToWork: tables.seekerProfiles.isOpenToWork,
        completionPct: tables.seekerProfiles.completionPct,
        fullName: tables.users.nameEn,
        fullNameMl: tables.users.nameMl,
        phone: tables.users.phone,
        primaryProfession: tables.users.primaryProfession,
        preferredLanguage: tables.users.preferredLanguage,
        isVerifiedProfessional: tables.users.isVerifiedProfessional,
      })
      .from(tables.seekerProfiles)
      .innerJoin(tables.users, eq(tables.users.id, tables.seekerProfiles.userId))
      .where(and(eq(tables.seekerProfiles.userId, ctx.user.id), isNull(tables.seekerProfiles.deletedAt)))
      .limit(1);
    return row ?? null;
  }),

  getCompletionChecklist: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        nameEn: tables.users.nameEn,
        primaryProfession: tables.users.primaryProfession,
        homeDistrict: tables.seekerProfiles.homeDistrict,
        totalExperienceMonths: tables.seekerProfiles.totalExperienceMonths,
        salaryMin: tables.seekerProfiles.expectedSalaryMinPaise,
        preferredCategories: tables.seekerProfiles.preferredCategories,
      })
      .from(tables.seekerProfiles)
      .innerJoin(tables.users, eq(tables.users.id, tables.seekerProfiles.userId))
      .where(eq(tables.seekerProfiles.userId, ctx.user.id))
      .limit(1);

    const link = '/seeker/profile/setup';
    return [
      { item: 'Add your name', done: Boolean(row?.nameEn), link },
      { item: 'Set your district', done: Boolean(row?.homeDistrict), link },
      { item: 'Add your profession', done: Boolean(row?.primaryProfession), link },
      { item: 'Add work experience', done: (row?.totalExperienceMonths ?? 0) > 0, link },
      { item: 'Set salary expectation', done: (row?.salaryMin ?? 0) > 0, link },
      { item: 'Pick job categories', done: (row?.preferredCategories.length ?? 0) > 0, link },
    ];
  }),
});
