import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, count, eq, gte, inArray, isNull, sql, tables, type SQL } from '@ddotsjobs/db';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

const DISTRICTS = [
  'thiruvananthapuram', 'kollam', 'pathanamthitta', 'alappuzha', 'kottayam',
  'idukki', 'ernakulam', 'thrissur', 'palakkad', 'malappuram', 'kozhikode',
  'wayanad', 'kannur', 'kasaragod',
] as const;

const JOB_TYPES = [
  'full_time', 'part_time', 'contract', 'walk_in', 'gulf', 'internship', 'temporary',
] as const;

const IT_PARKS = [
  'technopark', 'infopark', 'cyberpark', 'kinfra', 'ust_global_campus', 'other',
] as const;

const SORTS = ['latest', 'salary_desc', 'salary_asc'] as const;

const listInput = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  districts: z.array(z.enum(DISTRICTS)).optional(),
  categories: z.array(z.string().max(100)).optional(),
  jobTypes: z.array(z.enum(JOB_TYPES)).optional(),
  salaryMin: z.number().int().nonnegative().optional(), // paise
  isWalkIn: z.boolean().optional(),
  valuesGulfExperience: z.boolean().optional(),
  salaryDisclosed: z.boolean().optional(),
  itPark: z.enum(IT_PARKS).optional(),
  sort: z.enum(SORTS).default('latest'),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).default(20),
});

export type JobsListInput = z.infer<typeof listInput>;

export interface JobListItem {
  id: string;
  slug: string | null;
  titleEn: string;
  district: string | null;
  jobType: string;
  salaryMinPaise: number | null;
  salaryDisclosed: boolean;
  publishedAt: Date | null;
  viewCount: number;
  isWalkIn: boolean;
  valuesGulfExperience: boolean;
  company: string;
  isVerified: boolean;
  walkInStartsAt: Date | null;
}

// Shared WHERE conditions for both list + count (excludes cursor).
function baseConditions(input: z.infer<typeof listInput> | z.infer<typeof countInput>): SQL[] {
  const j = tables.jobs;
  const conds: SQL[] = [eq(j.status, 'active'), isNull(j.deletedAt)];
  if (input.districts?.length) conds.push(inArray(j.district, input.districts));
  if (input.categories?.length) conds.push(inArray(j.categorySlug, input.categories));
  if (input.jobTypes?.length) conds.push(inArray(j.type, input.jobTypes));
  if (input.salaryMin != null) conds.push(gte(j.salaryMinPaise, input.salaryMin));
  if (input.isWalkIn) conds.push(eq(j.isWalkIn, true));
  if (input.valuesGulfExperience) conds.push(eq(j.valuesGulfExperience, true));
  if (input.salaryDisclosed) conds.push(eq(j.salaryDisclosed, true));
  if (input.itPark) conds.push(eq(j.itPark, input.itPark));
  if (input.q) conds.push(sql`${j.tsv} @@ websearch_to_tsquery('simple', ${input.q})`);
  return conds;
}

const countInput = listInput.omit({ sort: true, cursor: true, limit: true });

export const jobsRouter = router({
  count: publicProcedure.input(countInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({ c: count() })
      .from(tables.jobs)
      .where(and(...baseConditions(input)));
    return { total: rows[0]?.c ?? 0 };
  }),

  list: publicProcedure.input(listInput).query(async ({ ctx, input }) => {
    const j = tables.jobs;
    const e = tables.employers;

    const conds = baseConditions(input);

    // Keyset (cursor) pagination. orderExpr is a total order so nulls don't break it.
    const desc = input.sort !== 'salary_asc';
    const orderMain =
      input.sort === 'latest'
        ? sql`coalesce(jobs.published_at, jobs.created_at)`
        : sql`coalesce(jobs.salary_min_paise, 0)`;
    const orderCur =
      input.sort === 'latest'
        ? sql`coalesce(cur.published_at, cur.created_at)`
        : sql`coalesce(cur.salary_min_paise, 0)`;

    if (input.cursor) {
      const cmp = desc ? sql`<` : sql`>`;
      conds.push(
        sql`(${orderMain}, jobs.id) ${cmp} ((SELECT ${orderCur} FROM jobs cur WHERE cur.id = ${input.cursor}), ${input.cursor}::uuid)`,
      );
    }

    const dir = desc ? sql`desc` : sql`asc`;

    const rows = await ctx.db
      .select({
        id: j.id,
        slug: j.slug,
        titleEn: j.titleEn,
        district: j.district,
        jobType: j.type,
        salaryMinPaise: j.salaryMinPaise,
        salaryDisclosed: j.salaryDisclosed,
        publishedAt: j.publishedAt,
        viewCount: j.viewCount,
        isWalkIn: j.isWalkIn,
        valuesGulfExperience: j.valuesGulfExperience,
        displayNameEn: e.displayNameEn,
        legalNameEn: e.legalNameEn,
        verificationStatus: e.verificationStatus,
        walkInStartsAt: sql<Date | null>`(SELECT min(w.starts_at) FROM walk_in_events w WHERE w.job_id = jobs.id AND w.deleted_at IS NULL)`,
      })
      .from(j)
      .innerJoin(e, eq(j.employerId, e.id))
      .where(and(...conds))
      .orderBy(sql`${orderMain} ${dir}, jobs.id ${dir}`)
      .limit(input.limit);

    const items: JobListItem[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      titleEn: r.titleEn,
      district: r.district,
      jobType: r.jobType,
      salaryMinPaise: r.salaryMinPaise,
      salaryDisclosed: r.salaryDisclosed,
      publishedAt: r.publishedAt,
      viewCount: r.viewCount,
      isWalkIn: r.isWalkIn,
      valuesGulfExperience: r.valuesGulfExperience,
      company: r.displayNameEn ?? r.legalNameEn,
      isVerified: r.verificationStatus === 'verified',
      walkInStartsAt: r.walkInStartsAt,
    }));

    const nextCursor =
      items.length === input.limit ? (items[items.length - 1]?.id ?? null) : null;

    return { items, nextCursor };
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const j = tables.jobs;
      const e = tables.employers;
      const [row] = await ctx.db
        .select({
          id: j.id,
          slug: j.slug,
          titleEn: j.titleEn,
          titleMl: j.titleMl,
          descriptionEn: j.descriptionEn,
          descriptionMl: j.descriptionMl,
          type: j.type,
          district: j.district,
          itPark: j.itPark,
          gulfCountry: j.gulfCountry,
          locationText: j.locationText,
          isRemote: j.isRemote,
          salaryMinPaise: j.salaryMinPaise,
          salaryMaxPaise: j.salaryMaxPaise,
          salaryPeriod: j.salaryPeriod,
          salaryDisclosed: j.salaryDisclosed,
          minExperienceYears: j.minExperienceYears,
          skills: j.skills,
          requirementsEn: j.requirementsEn,
          requirementsMl: j.requirementsMl,
          benefitsEn: j.benefitsEn,
          benefitsMl: j.benefitsMl,
          employerQuestionEn: j.employerQuestionEn,
          employerQuestionMl: j.employerQuestionMl,
          requiredCertifications: j.requiredCertifications,
          validThrough: j.validThrough,
          publishedAt: j.publishedAt,
          viewCount: j.viewCount,
          isWalkIn: j.isWalkIn,
          valuesGulfExperience: j.valuesGulfExperience,
          categorySlug: j.categorySlug,
          employerId: j.employerId,
          displayNameEn: e.displayNameEn,
          legalNameEn: e.legalNameEn,
          verificationStatus: e.verificationStatus,
          logoR2Key: e.logoR2Key,
          websiteUrl: e.websiteUrl,
          employerDistrict: e.district,
          employerType: e.type,
        })
        .from(j)
        .innerJoin(e, eq(j.employerId, e.id))
        .where(and(eq(j.slug, input.slug), isNull(j.deletedAt)))
        .limit(1);

      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });

      let walkIn: {
        venueEn: string;
        venueMl: string | null;
        district: string | null;
        addressText: string | null;
        startsAt: Date;
        endsAt: Date | null;
        instructionsEn: string | null;
        instructionsMl: string | null;
      } | null = null;
      if (row.isWalkIn) {
        const w = tables.walkInEvents;
        const [ev] = await ctx.db
          .select({
            venueEn: w.venueEn,
            venueMl: w.venueMl,
            district: w.district,
            addressText: w.addressText,
            startsAt: w.startsAt,
            endsAt: w.endsAt,
            instructionsEn: w.instructionsEn,
            instructionsMl: w.instructionsMl,
          })
          .from(w)
          .where(and(eq(w.jobId, row.id), isNull(w.deletedAt)))
          .orderBy(asc(w.startsAt))
          .limit(1);
        walkIn = ev ?? null;
      }

      const { displayNameEn, legalNameEn, verificationStatus, ...rest } = row;
      return {
        ...rest,
        company: displayNameEn ?? legalNameEn,
        isVerified: verificationStatus === 'verified',
        walkIn,
      };
    }),

  incrementView: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tables.jobs)
        .set({ viewCount: sql`${tables.jobs.viewCount} + 1` })
        .where(eq(tables.jobs.id, input.id));
      return { ok: true as const };
    }),

  isSaved: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ id: tables.savedJobs.id })
        .from(tables.savedJobs)
        .where(
          and(
            eq(tables.savedJobs.userId, ctx.user.id),
            eq(tables.savedJobs.jobId, input.jobId),
            isNull(tables.savedJobs.deletedAt),
          ),
        )
        .limit(1);
      return { saved: Boolean(row) };
    }),

  toggleSave: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const s = tables.savedJobs;
      const [existing] = await ctx.db
        .select({ id: s.id, deletedAt: s.deletedAt })
        .from(s)
        .where(and(eq(s.userId, ctx.user.id), eq(s.jobId, input.jobId)))
        .limit(1);

      if (!existing) {
        await ctx.db.insert(s).values({ userId: ctx.user.id, jobId: input.jobId });
        return { saved: true as const };
      }
      if (existing.deletedAt) {
        await ctx.db.update(s).set({ deletedAt: null }).where(eq(s.id, existing.id));
        return { saved: true as const };
      }
      await ctx.db.update(s).set({ deletedAt: new Date() }).where(eq(s.id, existing.id));
      return { saved: false as const };
    }),
});
