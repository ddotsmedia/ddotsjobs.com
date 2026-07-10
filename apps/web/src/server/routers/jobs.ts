import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, count, createNotification, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql, tables, type SQL } from '@ddotsjobs/db';
import { callAI } from '@ddotsjobs/ai';
import { jobAutoFillDescriptionPrompt, searchParseNaturalLanguagePrompt, jobSuggestTitlesPrompt, jobSuggestSkillsPrompt, salaryBenchmarkPrompt } from '@ddotsjobs/ai/prompts';
import { SECTORS } from '@/lib/constants';
import { sanitizeHtml, stripHtml } from '@/lib/sanitize';
import { rateLimit } from '../rate-limit.js';
import { notifyGoogleIndexing } from '@/lib/google-indexing';
import { assertAiEnabled, isEnabled } from '@/lib/site-settings';
import { alertsQueue, searchSyncQueue } from '../queue.js';
import { protectedProcedure, publicProcedure, roleProcedure, router } from '../trpc.js';

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
  salaryMax: z.number().int().nonnegative().optional(), // paise
  experience: z.array(z.enum(['entry', 'mid', 'senior', 'lead'])).optional(),
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
  cultureAvg?: number | null;
  cultureCount?: number;
}

// Shared WHERE conditions for both list + count (excludes cursor).
function baseConditions(input: z.infer<typeof listInput> | z.infer<typeof countInput>): SQL[] {
  const j = tables.jobs;
  const conds: SQL[] = [eq(j.status, 'active'), isNull(j.deletedAt)];
  if (input.districts?.length) conds.push(inArray(j.district, input.districts));
  if (input.categories?.length) conds.push(inArray(j.categorySlug, input.categories));
  if (input.jobTypes?.length) conds.push(inArray(j.type, input.jobTypes));
  if (input.salaryMin != null) conds.push(gte(j.salaryMinPaise, input.salaryMin));
  // Upper bound applies to the job's floor salary (null-safe; undisclosed
  // salaries are excluded when a range is set).
  if (input.salaryMax != null) conds.push(lte(j.salaryMinPaise, input.salaryMax));
  // Experience buckets on min_experience_months (OR within experience, AND with
  // the rest): entry 0–2yr, mid 2–5yr, senior 5–10yr, lead 10yr+.
  if (input.experience?.length) {
    const m = j.minExperienceMonths;
    const ex: SQL[] = [];
    for (const lvl of input.experience) {
      if (lvl === 'entry') ex.push(and(gte(m, 0), lt(m, 24))!);
      else if (lvl === 'mid') ex.push(and(gte(m, 24), lt(m, 60))!);
      else if (lvl === 'senior') ex.push(and(gte(m, 60), lt(m, 120))!);
      else if (lvl === 'lead') ex.push(gte(m, 120));
    }
    const orExp = or(...ex);
    if (orExp) conds.push(orExp);
  }
  if (input.isWalkIn) conds.push(eq(j.isWalkIn, true));
  if (input.valuesGulfExperience) conds.push(eq(j.valuesGulfExperience, true));
  if (input.salaryDisclosed) conds.push(eq(j.salaryDisclosed, true));
  if (input.itPark) conds.push(eq(j.itPark, input.itPark));
  if (input.q) conds.push(sql`${j.tsv} @@ websearch_to_tsquery('simple', ${input.q})`);
  return conds;
}

const countInput = listInput.omit({ sort: true, cursor: true, limit: true });

const CREATE_JOB_TYPES = [
  'full_time', 'part_time', 'contract', 'internship', 'walk_in', 'freelance',
] as const;
// 'freelance' is not in the job_type enum — map it to the closest value.
const JOB_TYPE_ENUM: Record<string, 'full_time' | 'part_time' | 'contract' | 'internship' | 'walk_in'> = {
  full_time: 'full_time', part_time: 'part_time', contract: 'contract',
  internship: 'internship', walk_in: 'walk_in', freelance: 'contract',
};

const jobInput = z.object({
  title: z.string().min(3).max(255),
  titleMl: z.string().max(255).optional(),
  category: z.string().min(1).max(100),
  district: z.enum(DISTRICTS),
  jobType: z.enum(CREATE_JOB_TYPES).default('full_time'),
  description: z.string().min(50),
  descriptionMl: z.string().optional(),
  requirements: z.string().optional(),
  salaryMinPaise: z.number().int().nonnegative().optional(),
  salaryMaxPaise: z.number().int().nonnegative().optional(),
  salaryDisclosed: z.boolean().default(true),
  salaryPeriod: z.string().max(20).default('month'),
  languageRequirement: z.enum(['ml', 'en', 'both']).default('both'),
  minExperienceMonths: z.number().int().nonnegative().default(0),
  requiredCertifications: z.array(z.string().max(40)).default([]),
  isWalkIn: z.boolean().default(false),
  walkInStartAt: z.string().datetime().optional(),
  walkInEndAt: z.string().datetime().optional(),
  walkInVenue: z.string().max(255).optional(),
  walkInVenueMl: z.string().max(255).optional(),
  walkInDocumentsMl: z.string().optional(),
  valuesGulfExperience: z.boolean().default(false),
  employerQuestion: z.string().max(500).optional(),
  validThrough: z.string().datetime().optional(),
  itParkId: z.string().uuid().optional(),
});

// Create uses extra cross-field rules; update reuses the base object (.omit/.partial).
const jobCreateInput = jobInput
  .refine((v) => v.salaryMinPaise == null || v.salaryMaxPaise == null || v.salaryMaxPaise >= v.salaryMinPaise, {
    message: 'Maximum salary must be greater than or equal to minimum salary',
    path: ['salaryMaxPaise'],
  })
  .refine((v) => !v.validThrough || new Date(v.validThrough).getTime() > Date.now(), {
    message: 'Valid-through date must be in the future',
    path: ['validThrough'],
  });

function jobSlug(title: string, district: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'job';
  return `${base}-${district}-${randomBytes(3).toString('hex')}`;
}

export const jobsRouter = router({
  // Natural-language → structured filters (Gemini Flash). Returns parsed filters
  // + confidence; the client decides whether to auto-apply.
  aiSearch: publicProcedure
    .input(z.object({ query: z.string().min(2).max(160) }))
    .mutation(async ({ input }) => {
      await assertAiEnabled();
      const spec = searchParseNaturalLanguagePrompt({
        query: input.query,
        availableCategories: SECTORS.map((s) => s.slug),
        availableDistricts: [...DISTRICTS],
      });
      try {
        const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
        return data;
      } catch {
        // AI unavailable → caller falls back to plain text search.
        return { category: null, district: null, salaryMin: null, jobType: null, isWalkIn: null, valuesGulfExperience: null, confidence: 0 };
      }
    }),

  // AI: title suggestions (Redis-cached per category+partial).
  suggestTitles: roleProcedure('employer')
    .input(z.object({ partialTitle: z.string().max(120).default(''), category: z.string().max(60) }))
    .mutation(async ({ ctx, input }) => {
      await assertAiEnabled();
      const key = `ai:titles:${input.category}:${input.partialTitle.slice(0, 24).toLowerCase()}`;
      const cached = await ctx.redis.get(key);
      if (cached) return JSON.parse(cached) as { titles: string[] };
      const spec = jobSuggestTitlesPrompt(input);
      try {
        const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
        await ctx.redis.set(key, JSON.stringify(data), 'EX', 3600);
        return data;
      } catch {
        return { titles: [] };
      }
    }),

  // AI: skill suggestions (Redis-cached per title+category, 24h).
  suggestSkills: roleProcedure('employer')
    .input(z.object({ title: z.string().max(120), category: z.string().max(60) }))
    .mutation(async ({ ctx, input }) => {
      await assertAiEnabled();
      const key = `ai:skills:${input.category}:${input.title.slice(0, 32).toLowerCase()}`;
      const cached = await ctx.redis.get(key);
      if (cached) return JSON.parse(cached) as { skills: string[] };
      const spec = jobSuggestSkillsPrompt(input);
      try {
        const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
        await ctx.redis.set(key, JSON.stringify(data), 'EX', 86_400);
        return data;
      } catch {
        return { skills: [] };
      }
    }),

  // AI: salary benchmark (rupees), Redis-cached 24h. Returns paise too for the form.
  salaryBenchmark: roleProcedure('employer')
    .input(z.object({ category: z.string().max(60), district: z.string().max(40), experienceMin: z.number().int().min(0).max(40).default(0) }))
    .mutation(async ({ ctx, input }) => {
      await assertAiEnabled();
      const key = `ai:salary:${input.category}:${input.district}:${input.experienceMin}`;
      const cached = await ctx.redis.get(key);
      if (cached) return JSON.parse(cached) as { minPaise: number; maxPaise: number; medianPaise: number; confidence: string; sampleSize: number };
      const spec = salaryBenchmarkPrompt(input);
      try {
        const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
        const out = { minPaise: data.min * 100, maxPaise: data.max * 100, medianPaise: data.median * 100, confidence: data.confidence, sampleSize: data.sampleSize };
        await ctx.redis.set(key, JSON.stringify(out), 'EX', 86_400);
        return out;
      } catch {
        return { minPaise: 0, maxPaise: 0, medianPaise: 0, confidence: 'low', sampleSize: 0 };
      }
    }),

  // Compare 2-3 jobs side by side (public). Missing/deleted ids are just omitted.
  compareJobs: publicProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(2).max(3) }))
    .query(async ({ ctx, input }) => {
      const j = tables.jobs;
      const e = tables.employers;
      const rows = await ctx.db
        .select({
          id: j.id,
          slug: j.slug,
          titleEn: j.titleEn,
          type: j.type,
          district: j.district,
          locationText: j.locationText,
          isRemote: j.isRemote,
          salaryMinPaise: j.salaryMinPaise,
          salaryMaxPaise: j.salaryMaxPaise,
          salaryDisclosed: j.salaryDisclosed,
          minExperienceMonths: j.minExperienceMonths,
          skills: j.skills,
          benefitsEn: j.benefitsEn,
          requiredCertifications: j.requiredCertifications,
          isWalkIn: j.isWalkIn,
          publishedAt: j.publishedAt,
          categorySlug: j.categorySlug,
          company: sql<string>`coalesce(${e.displayNameEn}, ${e.legalNameEn})`,
          isVerified: sql<boolean>`(${e.verificationStatus} = 'verified')`,
        })
        .from(j)
        .innerJoin(e, eq(j.employerId, e.id))
        .where(and(inArray(j.id, input.ids), isNull(j.deletedAt)))
        .limit(3);
      // Preserve the requested order.
      const byId = new Map(rows.map((r) => [r.id, r]));
      return { jobs: input.ids.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x)) };
    }),

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
        cultureAvg: sql<number | null>`(SELECT round(avg(cr.rating)::numeric, 1) FROM company_reviews cr WHERE cr.employer_id = ${e.id} AND cr.deleted_at IS NULL)`,
        cultureCount: sql<number>`(SELECT count(*)::int FROM company_reviews cr WHERE cr.employer_id = ${e.id} AND cr.deleted_at IS NULL)`,
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
      cultureAvg: r.cultureAvg != null ? Number(r.cultureAvg) : null,
      cultureCount: r.cultureCount,
    }));

    const nextCursor =
      items.length === input.limit ? (items[items.length - 1]?.id ?? null) : null;

    return { items, nextCursor };
  }),

  // SEO segment listings (district / category pages): top-N, no pagination.
  segment: publicProcedure
    .input(
      z.object({
        district: z.enum(DISTRICTS).optional(),
        category: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(50).default(50),
      }),
    )
    .query(async ({ ctx, input }): Promise<{ items: JobListItem[] }> => {
      const j = tables.jobs;
      const e = tables.employers;
      const conds: SQL[] = [eq(j.status, 'active'), isNull(j.deletedAt)];
      if (input.district) conds.push(eq(j.district, input.district));
      if (input.category) conds.push(eq(j.categorySlug, input.category));

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
        .orderBy(sql`coalesce(jobs.published_at, jobs.created_at) desc, jobs.id desc`)
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
      return { items };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const j = tables.jobs;
      const e = tables.employers;
      // Jobs without a published slug are linked by UUID id; accept either.
      // Guard the id-branch to UUID-shaped input — a real slug would crash the
      // uuid column cast ("invalid input syntax for type uuid").
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const slugOrId = UUID_RE.test(input.slug)
        ? or(eq(j.slug, input.slug), eq(j.id, input.slug))
        : eq(j.slug, input.slug);
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
          employerSlug: e.slug,
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
        .where(and(slugOrId, isNull(j.deletedAt)))
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
      const [row] = await ctx.db
        .update(tables.jobs)
        .set({ viewCount: sql`${tables.jobs.viewCount} + 1` })
        .where(eq(tables.jobs.id, input.id))
        .returning({ employerId: tables.jobs.employerId });
      // Time-series event for the employer analytics dashboard. Non-critical:
      // a failure here must never break the view counter.
      if (row) {
        try {
          await ctx.db.insert(tables.analyticsEvents).values({
            eventType: 'job_view',
            jobId: input.id,
            employerId: row.employerId,
            viewerUserId: ctx.session?.user?.id ?? null,
          });
        } catch {
          /* analytics is best-effort */
        }
      }
      return { ok: true as const };
    }),

  // Fire-and-forget: employer public profile page view.
  trackProfileView: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [emp] = await ctx.db
          .select({ id: tables.employers.id })
          .from(tables.employers)
          .where(and(eq(tables.employers.slug, input.slug), isNull(tables.employers.deletedAt)))
          .limit(1);
        if (emp) {
          await ctx.db.insert(tables.analyticsEvents).values({
            eventType: 'profile_view',
            employerId: emp.id,
            viewerUserId: ctx.session?.user?.id ?? null,
          });
        }
      } catch {
        /* best-effort */
      }
      return { ok: true as const };
    }),

  // Fire-and-forget: seeker clicked the Apply CTA on a job (funnel step).
  trackApplyCta: publicProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [job] = await ctx.db
          .select({ employerId: tables.jobs.employerId })
          .from(tables.jobs)
          .where(eq(tables.jobs.id, input.jobId))
          .limit(1);
        if (job) {
          await ctx.db.insert(tables.analyticsEvents).values({
            eventType: 'apply_cta_click',
            jobId: input.jobId,
            employerId: job.employerId,
            viewerUserId: ctx.session?.user?.id ?? null,
          });
        }
      } catch {
        /* best-effort */
      }
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

  // ── Seeker: saved jobs list ──────────────────────────────────────────
  // Returns the user's whole saved set (bounded); the page sorts/filters/
  // searches client-side. Sort/filter server-side isn't needed at this size.
  getSavedJobs: protectedProcedure.query(async ({ ctx }) => {
    const j = tables.jobs;
    const s = tables.savedJobs;
    return ctx.db
      .select({
        id: j.id,
        slug: j.slug,
        titleEn: j.titleEn,
        district: j.district,
        categorySlug: j.categorySlug,
        jobType: j.type,
        status: j.status,
        salaryMinPaise: j.salaryMinPaise,
        salaryMaxPaise: j.salaryMaxPaise,
        salaryDisclosed: j.salaryDisclosed,
        isWalkIn: j.isWalkIn,
        validThrough: j.validThrough,
        company: sql<string>`coalesce(${tables.employers.displayNameEn}, ${tables.employers.legalNameEn})`,
        savedAt: s.createdAt,
      })
      .from(s)
      .innerJoin(j, eq(j.id, s.jobId))
      .innerJoin(tables.employers, eq(tables.employers.id, j.employerId))
      .where(and(eq(s.userId, ctx.user.id), isNull(s.deletedAt), isNull(j.deletedAt)))
      .orderBy(desc(s.createdAt))
      .limit(200);
  }),

  // Count of active saved jobs — for the seeker nav badge.
  getSavedJobCount: protectedProcedure.query(async ({ ctx }) => {
    const s = tables.savedJobs;
    const [row] = await ctx.db
      .select({ n: count() })
      .from(s)
      .innerJoin(tables.jobs, eq(tables.jobs.id, s.jobId))
      .where(and(eq(s.userId, ctx.user.id), isNull(s.deletedAt), isNull(tables.jobs.deletedAt)));
    return { count: row?.n ?? 0 };
  }),

  // Just the saved jobIds — lets listing cards render heart state in one query.
  getSavedJobIds: protectedProcedure.query(async ({ ctx }) => {
    const s = tables.savedJobs;
    const rows = await ctx.db
      .select({ jobId: s.jobId })
      .from(s)
      .where(and(eq(s.userId, ctx.user.id), isNull(s.deletedAt)));
    return rows.map((r) => r.jobId);
  }),

  // Bulk unsave (soft-delete) — scoped to the caller's own saved rows.
  unsaveMany: protectedProcedure
    .input(z.object({ jobIds: z.array(z.string().uuid()).min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const s = tables.savedJobs;
      await ctx.db
        .update(s)
        .set({ deletedAt: new Date() })
        .where(and(eq(s.userId, ctx.user.id), inArray(s.jobId, input.jobIds), isNull(s.deletedAt)));
      return { unsaved: input.jobIds.length };
    }),

  // ── Employer: re-blast a job to WhatsApp groups (1 / job / 3 days) ────
  boostJob: roleProcedure('employer')
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [job] = await ctx.db
        .select({ id: tables.jobs.id, lastBoostedAt: tables.jobs.lastBoostedAt })
        .from(tables.jobs)
        .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
        .where(and(eq(tables.jobs.id, input.jobId), eq(tables.employers.ownerUserId, ctx.user.id), isNull(tables.jobs.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });
      if (job.lastBoostedAt && Date.now() - new Date(job.lastBoostedAt).getTime() < 3 * 86_400_000) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Already boosted in the last 3 days.' });
      }
      await alertsQueue.add('match_job_alerts', { jobId: input.jobId }, { priority: 10 });
      await ctx.db.update(tables.jobs).set({ lastBoostedAt: new Date() }).where(eq(tables.jobs.id, input.jobId));
      return { success: true as const };
    }),

  // ── Employer: post a job ─────────────────────────────────────────────
  create: roleProcedure('employer').input(jobCreateInput).mutation(async ({ ctx, input }) => {
    await rateLimit(ctx.redis, `jobcreate:${ctx.user.id}`, 10, 3600);
    const [emp] = await ctx.db
      .select({
        id: tables.employers.id,
        verificationStatus: tables.employers.verificationStatus,
        jobsPosted: tables.employers.jobsPostedThisPeriod,
        jobsLimit: tables.employers.jobsLimitThisPeriod,
      })
      .from(tables.employers)
      .where(and(eq(tables.employers.ownerUserId, ctx.user.id), isNull(tables.employers.deletedAt)))
      .limit(1);
    if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Register your company first' });
    if (emp.jobsPosted >= emp.jobsLimit) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Job post limit reached. Upgrade your plan.' });
    }
    if (input.isWalkIn && !input.walkInStartAt) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Walk-in date is required' });
    }
    if (input.salaryMaxPaise != null && input.salaryMinPaise != null && input.salaryMaxPaise < input.salaryMinPaise) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum salary is below minimum' });
    }

    // Feature-flag gated publish flow (admin site_settings).
    const verified = emp.verificationStatus === 'verified';
    const modRequired = await isEnabled('job_moderation_required', true);
    const autoApprove = await isEnabled('auto_approve_verified', false);
    let status: 'active' | 'pending_review';
    if (!modRequired) status = 'active';
    else if (autoApprove && verified) status = 'active';
    else status = 'pending_review';
    const slug = jobSlug(input.title, input.district);
    const now = new Date();

    const [row] = await ctx.db
      .insert(tables.jobs)
      .values({
        employerId: emp.id,
        slug,
        titleEn: stripHtml(input.title),
        titleMl: input.titleMl ? stripHtml(input.titleMl) : null,
        descriptionEn: sanitizeHtml(input.description),
        descriptionMl: input.descriptionMl ? sanitizeHtml(input.descriptionMl) : null,
        requirementsEn: input.requirements ?? null,
        type: JOB_TYPE_ENUM[input.jobType],
        status,
        district: input.district,
        categorySlug: input.category,
        salaryMinPaise: input.salaryMinPaise ?? null,
        salaryMaxPaise: input.salaryMaxPaise ?? null,
        salaryDisclosed: input.salaryDisclosed,
        salaryPeriod: input.salaryPeriod,
        languageRequirement: input.languageRequirement,
        minExperienceMonths: input.minExperienceMonths,
        requiredCertifications: input.requiredCertifications,
        isWalkIn: input.isWalkIn,
        valuesGulfExperience: input.valuesGulfExperience,
        employerQuestionEn: input.employerQuestion ?? null,
        validThrough: input.validThrough ? new Date(input.validThrough) : null,
        itParkId: input.itParkId ?? null,
        publishedAt: status === 'active' ? now : null,
      })
      .returning({ id: tables.jobs.id });
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    if (input.isWalkIn && input.walkInStartAt) {
      await ctx.db.insert(tables.walkInEvents).values({
        jobId: row.id,
        venueEn: input.walkInVenue ?? 'Walk-in venue',
        venueMl: input.walkInVenueMl ?? null,
        district: input.district,
        startsAt: new Date(input.walkInStartAt),
        endsAt: input.walkInEndAt ? new Date(input.walkInEndAt) : null,
        instructionsMl: input.walkInDocumentsMl ?? null,
      });
    }

    await ctx.db
      .update(tables.employers)
      .set({ jobsPostedThisPeriod: sql`${tables.employers.jobsPostedThisPeriod} + 1` })
      .where(eq(tables.employers.id, emp.id));

    if (status === 'active') {
      await alertsQueue.add('match_job_alerts', { jobId: row.id }, { priority: 10 });
      await searchSyncQueue.add('index', { jobId: row.id, action: 'index' });
      void notifyGoogleIndexing(`https://ddotsjobs.com/jobs/${slug}`);
    }

    await ctx.db.insert(tables.auditLog).values({
      actorUserId: ctx.user.id,
      action: 'job.created',
      entityType: 'job',
      entityId: row.id,
    });

    if (status === 'active') {
      await createNotification({
        userId: ctx.user.id,
        type: 'job.published',
        title: 'Job published',
        titleMl: 'Job publish ചെയ്തു',
        body: `${input.title} is now live`,
        bodyMl: `${input.title} ഇപ്പോൾ live ആണ്`,
        actionUrl: `/jobs/${slug}`,
      });
    } else {
      await createNotification({
        userId: ctx.user.id,
        type: 'job.pending',
        title: 'Job under review',
        titleMl: 'Job review-ൽ ഉണ്ട്',
        body: 'Your job post is being reviewed. Usually approved within a few hours.',
        actionUrl: '/employer/jobs',
      });
    }

    return { jobId: row.id, slug, status };
  }),

  // ── Employer: update a job (district/category locked) ────────────────
  update: roleProcedure('employer')
    .input(
      jobInput
        .omit({ district: true, category: true, isWalkIn: true, walkInStartAt: true, walkInEndAt: true, walkInVenue: true, walkInVenueMl: true, walkInDocumentsMl: true })
        .partial()
        .extend({ jobId: z.string().uuid() }),
    )
    .mutation(async ({ ctx, input }) => {
      const [job] = await ctx.db
        .select({ id: tables.jobs.id, slug: tables.jobs.slug, status: tables.jobs.status })
        .from(tables.jobs)
        .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
        .where(and(eq(tables.jobs.id, input.jobId), eq(tables.employers.ownerUserId, ctx.user.id), isNull(tables.jobs.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });

      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) set.titleEn = input.title;
      if (input.titleMl !== undefined) set.titleMl = input.titleMl;
      if (input.description !== undefined) set.descriptionEn = input.description;
      if (input.descriptionMl !== undefined) set.descriptionMl = input.descriptionMl;
      if (input.requirements !== undefined) set.requirementsEn = input.requirements;
      if (input.jobType !== undefined) set.type = JOB_TYPE_ENUM[input.jobType];
      if (input.salaryMinPaise !== undefined) set.salaryMinPaise = input.salaryMinPaise;
      if (input.salaryMaxPaise !== undefined) set.salaryMaxPaise = input.salaryMaxPaise;
      if (input.salaryDisclosed !== undefined) set.salaryDisclosed = input.salaryDisclosed;
      if (input.languageRequirement !== undefined) set.languageRequirement = input.languageRequirement;
      if (input.minExperienceMonths !== undefined) set.minExperienceMonths = input.minExperienceMonths;
      if (input.requiredCertifications !== undefined) set.requiredCertifications = input.requiredCertifications;
      if (input.valuesGulfExperience !== undefined) set.valuesGulfExperience = input.valuesGulfExperience;
      if (input.employerQuestion !== undefined) set.employerQuestionEn = input.employerQuestion;
      if (input.validThrough !== undefined) set.validThrough = new Date(input.validThrough);
      if (input.itParkId !== undefined) set.itParkId = input.itParkId;

      await ctx.db.update(tables.jobs).set(set).where(eq(tables.jobs.id, input.jobId));
      // Profile/content change invalidates cached fit scores.
      await ctx.db.delete(tables.fitScores).where(eq(tables.fitScores.jobId, input.jobId));

      if (job.status === 'active') {
        await alertsQueue.add('match_job_alerts', { jobId: input.jobId }, { priority: 10 });
        await searchSyncQueue.add('index', { jobId: input.jobId, action: 'index' });
      }
      return { success: true as const };
    }),

  myJobs: roleProcedure('employer').query(async ({ ctx }) => {
    const j = tables.jobs;
    return ctx.db
      .select({
        id: j.id,
        title: j.titleEn,
        slug: j.slug,
        status: j.status,
        district: j.district,
        category: j.categorySlug,
        salaryMinPaise: j.salaryMinPaise,
        salaryMaxPaise: j.salaryMaxPaise,
        salaryDisclosed: j.salaryDisclosed,
        isWalkIn: j.isWalkIn,
        publishedAt: j.publishedAt,
        validThrough: j.validThrough,
        viewCount: j.viewCount,
        applicationCount: j.applicationCount,
        walkInStartsAt: sql<Date | null>`(SELECT min(w.starts_at) FROM walk_in_events w WHERE w.job_id = jobs.id AND w.deleted_at IS NULL)`,
      })
      .from(j)
      .innerJoin(tables.employers, eq(tables.employers.id, j.employerId))
      .where(and(eq(tables.employers.ownerUserId, ctx.user.id), isNull(j.deletedAt)))
      .orderBy(desc(j.publishedAt), desc(j.createdAt))
      .limit(20);
  }),

  close: roleProcedure('employer')
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [job] = await ctx.db
        .select({ id: tables.jobs.id })
        .from(tables.jobs)
        .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
        .where(and(eq(tables.jobs.id, input.jobId), eq(tables.employers.ownerUserId, ctx.user.id)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });
      await ctx.db
        .update(tables.jobs)
        .set({ status: 'closed', closedAt: new Date() })
        .where(eq(tables.jobs.id, input.jobId));
      return { success: true as const };
    }),

  // Bulk close — scoped to the caller's own, non-deleted, not-already-closed
  // jobs. Returns the count actually closed (ignores ids that aren't theirs).
  closeMany: roleProcedure('employer')
    .input(z.object({ jobIds: z.array(z.string().uuid()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ctx.db
        .select({ id: tables.jobs.id })
        .from(tables.jobs)
        .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
        .where(
          and(
            inArray(tables.jobs.id, input.jobIds),
            eq(tables.employers.ownerUserId, ctx.user.id),
            isNull(tables.jobs.deletedAt),
            ne(tables.jobs.status, 'closed'),
          ),
        );
      const ids = owned.map((r) => r.id);
      if (ids.length === 0) return { closed: 0 };
      await ctx.db
        .update(tables.jobs)
        .set({ status: 'closed', closedAt: new Date() })
        .where(inArray(tables.jobs.id, ids));
      return { closed: ids.length };
    }),

  autoFillDescription: roleProcedure('employer')
    .input(
      z.object({
        title: z.string().min(1),
        category: z.string().min(1),
        district: z.string().min(1),
        language: z.enum(['ml', 'en', 'both']).default('both'),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAiEnabled();
      try {
        const spec = jobAutoFillDescriptionPrompt(input);
        const { data } = await callAI({
          task: spec.task,
          prompt: spec.prompt,
          system: spec.system,
          schema: spec.schema,
        });
        return { description_en: data.description_en, description_ml: data.description_ml };
      } catch (err) {
        console.error('[jobs.autoFill] failed:', String(err));
        return null;
      }
    }),
});
