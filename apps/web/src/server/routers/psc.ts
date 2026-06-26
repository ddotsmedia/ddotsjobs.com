import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, ilike, isNull, lte, sql, tables } from '@ddotsjobs/db';
import { protectedProcedure, publicProcedure, roleProcedure, router } from '../trpc.js';

const ALERT_EVENTS = ['new_notification', 'exam_date', 'rank_list', 'advice'] as const;

export const pscRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        department: z.string().optional(),
        q: z.string().trim().min(1).max(120).optional(),
        cursor: z.number().int().nonnegative().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const t = tables.pscNotifications;
      const conds = [isNull(t.deletedAt)];
      if (input.status) conds.push(eq(t.status, input.status));
      if (input.department) conds.push(ilike(t.departmentEn, `%${input.department}%`));
      if (input.q) conds.push(sql`${t.tsv} @@ websearch_to_tsquery('simple', ${input.q})`);

      const offset = input.cursor ?? 0;
      const rows = await ctx.db
        .select({
          id: t.id,
          categoryNo: t.categoryNumber,
          postName: t.titleEn,
          postNameMl: t.titleMl,
          department: t.departmentEn,
          totalVacancies: t.vacancies,
          applicationEnd: t.lastDateToApply,
          examDate: t.examDate,
          status: t.status,
        })
        .from(t)
        .where(and(...conds))
        .orderBy(desc(t.updatedAt))
        .limit(input.limit)
        .offset(offset);

      const nextCursor = rows.length === input.limit ? offset + input.limit : null;
      return { items: rows, nextCursor };
    }),

  getByCategory: publicProcedure
    .input(z.object({ categoryNo: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const t = tables.pscNotifications;
      const [row] = await ctx.db
        .select({
          id: t.id,
          categoryNo: t.categoryNumber,
          postName: t.titleEn,
          postNameMl: t.titleMl,
          department: t.departmentEn,
          departmentMl: t.departmentMl,
          descriptionEn: t.descriptionEn,
          descriptionMl: t.descriptionMl,
          totalVacancies: t.vacancies,
          qualificationText: t.qualificationEn,
          scaleOfPay: t.scaleOfPay,
          district: t.district,
          applicationEnd: t.lastDateToApply,
          examDate: t.examDate,
          gazetteDate: t.gazetteDate,
          status: t.status,
          sourceUrl: t.sourceUrl,
        })
        .from(t)
        .where(and(eq(t.categoryNumber, input.categoryNo), isNull(t.deletedAt)))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Notification not found' });
      return row;
    }),

  subscribe: roleProcedure('seeker')
    .input(
      z.object({
        categoryNo: z.string().min(1),
        alertFor: z.array(z.enum(ALERT_EVENTS)).default([...ALERT_EVENTS]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const t = tables.pscSubscriptions;
      await ctx.db
        .insert(t)
        .values({
          userId: ctx.user.id,
          subscriptionType: 'category',
          subscriptionValue: input.categoryNo,
          alertFor: input.alertFor,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [t.userId, t.subscriptionValue],
          targetWhere: isNull(t.deletedAt),
          set: { alertFor: input.alertFor, isActive: true, updatedAt: new Date() },
        });
      return { success: true as const };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ categoryNo: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const t = tables.pscSubscriptions;
      await ctx.db
        .update(t)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(t.userId, ctx.user.id),
            eq(t.subscriptionValue, input.categoryNo),
            isNull(t.deletedAt),
          ),
        );
      return { success: true as const };
    }),

  myTracker: protectedProcedure.query(async ({ ctx }) => {
    const subs = tables.pscSubscriptions;
    const notif = tables.pscNotifications;
    const rows = await ctx.db
      .select({
        categoryNo: notif.categoryNumber,
        postName: notif.titleEn,
        postNameMl: notif.titleMl,
        department: notif.departmentEn,
        status: notif.status,
        examDate: notif.examDate,
        applicationEnd: notif.lastDateToApply,
        alertFor: subs.alertFor,
      })
      .from(subs)
      .innerJoin(
        notif,
        and(eq(subs.subscriptionValue, notif.categoryNumber), isNull(notif.deletedAt)),
      )
      .where(
        and(
          eq(subs.userId, ctx.user.id),
          eq(subs.subscriptionType, 'category'),
          eq(subs.isActive, true),
          isNull(subs.deletedAt),
        ),
      )
      .orderBy(desc(subs.updatedAt));
    return rows;
  }),

  examCalendar: publicProcedure.query(async ({ ctx }) => {
    const t = tables.pscNotifications;
    const rows = await ctx.db
      .select({
        id: t.id,
        categoryNo: t.categoryNumber,
        postName: t.titleEn,
        postNameMl: t.titleMl,
        examDate: t.examDate,
      })
      .from(t)
      .where(
        and(
          isNull(t.deletedAt),
          sql`${t.examDate} IS NOT NULL`,
          gte(t.examDate, sql`now()`),
          lte(t.examDate, sql`now() + interval '90 days'`),
        ),
      )
      .orderBy(t.examDate);
    return rows;
  }),
});
