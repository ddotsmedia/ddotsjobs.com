import { z } from 'zod';
import { and, count, desc, eq, sql, tables, type Database } from '@ddotsjobs/db';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

// Get-or-create the caller's email preferences row (defaults: all on, daily).
async function ensureEmailPrefs(db: Database, userId: string) {
  const p = tables.emailPreferences;
  await db.insert(p).values({ userId }).onConflictDoNothing({ target: p.userId });
  const [row] = await db.select().from(p).where(eq(p.userId, userId)).limit(1);
  return row!;
}

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

  // ── Email preferences (Phase 3.7) ────────────────────────────────────
  getEmailPreferences: protectedProcedure.query(async ({ ctx }) => {
    const p = await ensureEmailPrefs(ctx.db, ctx.user.id);
    return {
      notifyOnMessages: p.notifyOnMessages,
      notifyOnJobAlerts: p.notifyOnJobAlerts,
      notifyOnExpiry: p.notifyOnExpiry,
      notifyOnApplications: p.notifyOnApplications,
      notifyOnEndorsements: p.notifyOnEndorsements,
      digestFrequency: p.digestFrequency,
      unsubscribeToken: p.unsubscribeToken,
    };
  }),

  updateEmailPreferences: protectedProcedure
    .input(
      z.object({
        notifyOnMessages: z.boolean().optional(),
        notifyOnJobAlerts: z.boolean().optional(),
        notifyOnExpiry: z.boolean().optional(),
        notifyOnApplications: z.boolean().optional(),
        notifyOnEndorsements: z.boolean().optional(),
        digestFrequency: z.enum(['daily', 'weekly', 'never']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureEmailPrefs(ctx.db, ctx.user.id);
      const set: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(input)) if (v !== undefined) set[k] = v;
      await ctx.db
        .update(tables.emailPreferences)
        .set(set)
        .where(eq(tables.emailPreferences.userId, ctx.user.id));
      return { success: true as const };
    }),

  getEmailLogs: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: tables.emailLogs.id,
        eventType: tables.emailLogs.eventType,
        subject: tables.emailLogs.subject,
        status: tables.emailLogs.status,
        sentAt: tables.emailLogs.sentAt,
      })
      .from(tables.emailLogs)
      .where(eq(tables.emailLogs.userId, ctx.user.id))
      .orderBy(desc(tables.emailLogs.sentAt))
      .limit(50);
  }),

  // One-click unsubscribe — public, token-gated. Turns everything off.
  unsubscribeByToken: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const p = tables.emailPreferences;
      const [row] = await ctx.db.select({ id: p.id }).from(p).where(eq(p.unsubscribeToken, input.token)).limit(1);
      if (!row) return { ok: false as const };
      await ctx.db
        .update(p)
        .set({
          notifyOnMessages: false,
          notifyOnJobAlerts: false,
          notifyOnExpiry: false,
          notifyOnApplications: false,
          notifyOnEndorsements: false,
          digestFrequency: 'never',
          updatedAt: new Date(),
        })
        .where(eq(p.unsubscribeToken, input.token));
      return { ok: true as const };
    }),
});
