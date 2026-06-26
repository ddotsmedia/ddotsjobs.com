import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { publicProcedure, router } from '../trpc.js';
import type { JobListItem } from './jobs.js';

export const itParksRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: tables.itParks.id,
        slug: tables.itParks.slug,
        name: tables.itParks.name,
        city: tables.itParks.city,
        district: tables.itParks.district,
        totalCompanies: tables.itParks.totalCompanies,
        totalEmployees: tables.itParks.totalEmployees,
        establishedYear: tables.itParks.establishedYear,
        websiteUrl: tables.itParks.websiteUrl,
        activeJobsCount: tables.itParks.activeJobsCount,
      })
      .from(tables.itParks)
      .orderBy(desc(tables.itParks.totalEmployees));
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [park] = await ctx.db
        .select()
        .from(tables.itParks)
        .where(eq(tables.itParks.slug, input.slug))
        .limit(1);
      if (!park) throw new TRPCError({ code: 'NOT_FOUND', message: 'Park not found' });
      return park;
    }),

  jobs: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        category: z.string().max(100).optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(20).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [park] = await ctx.db
        .select({ id: tables.itParks.id })
        .from(tables.itParks)
        .where(eq(tables.itParks.slug, input.slug))
        .limit(1);
      if (!park) throw new TRPCError({ code: 'NOT_FOUND', message: 'Park not found' });

      const j = tables.jobs;
      const e = tables.employers;
      const conds = [
        eq(j.itParkId, park.id),
        eq(j.status, 'active'),
        isNull(j.deletedAt),
      ];
      if (input.category) conds.push(eq(j.categorySlug, input.category));
      if (input.cursor) {
        conds.push(
          sql`(coalesce(jobs.published_at, jobs.created_at), jobs.id) < ((SELECT coalesce(cur.published_at, cur.created_at) FROM jobs cur WHERE cur.id = ${input.cursor}), ${input.cursor}::uuid)`,
        );
      }

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

      const nextCursor = items.length === input.limit ? (items[items.length - 1]?.id ?? null) : null;
      return { items, nextCursor };
    }),
});
