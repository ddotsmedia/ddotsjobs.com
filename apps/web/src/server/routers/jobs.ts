import { z } from 'zod';
import { and, count, eq, gte, inArray, isNull, sql, tables, type SQL } from '@ddotsjobs/db';
import { publicProcedure, router } from '../trpc.js';

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
});
