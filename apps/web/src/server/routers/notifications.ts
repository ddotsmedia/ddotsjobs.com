import { z } from 'zod';
import { and, count, desc, eq, sql, tables } from '@ddotsjobs/db';
import { protectedProcedure, router } from '../trpc.js';

export const notificationsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().default(false),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const n = tables.notifications;
      const conds = [eq(n.userId, ctx.user.id)];
      if (input.unreadOnly) conds.push(eq(n.isRead, false));
      if (input.cursor) {
        conds.push(
          sql`(${n.createdAt}, ${n.id}) < ((SELECT created_at FROM notifications WHERE id = ${input.cursor}), ${input.cursor}::uuid)`,
        );
      }
      const items = await ctx.db
        .select()
        .from(n)
        .where(and(...conds))
        .orderBy(desc(n.createdAt), desc(n.id))
        .limit(input.limit);
      const nextCursor = items.length === input.limit ? (items[items.length - 1]?.id ?? null) : null;
      return { items, nextCursor };
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ c: count() })
      .from(tables.notifications)
      .where(and(eq(tables.notifications.userId, ctx.user.id), eq(tables.notifications.isRead, false)));
    return { count: row?.c ?? 0 };
  }),

  markRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tables.notifications)
        .set({ isRead: true })
        .where(and(eq(tables.notifications.id, input.notificationId), eq(tables.notifications.userId, ctx.user.id)));
      return { success: true as const };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(tables.notifications)
      .set({ isRead: true })
      .where(and(eq(tables.notifications.userId, ctx.user.id), eq(tables.notifications.isRead, false)));
    return { success: true as const };
  }),
});
