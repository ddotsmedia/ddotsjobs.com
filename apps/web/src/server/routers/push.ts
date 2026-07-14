import { createHash } from 'node:crypto';
import { z } from 'zod';
import { and, count, desc, eq, isNull, tables, type Database } from '@ddotsjobs/db';
import { encryptSecret } from '@ddotsjobs/config/crypto';
import { protectedProcedure, router } from '../trpc.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const hour = z.number().int().min(0).max(23);

async function ensurePrefs(db: Database, userId: string): Promise<void> {
  await db.insert(tables.pushPreferences).values({ userId }).onConflictDoNothing({ target: tables.pushPreferences.userId });
}

export const pushRouter = router({
  // Mobile app registers its FCM token on login. Token stored encrypted.
  registerDeviceToken: protectedProcedure
    .input(z.object({ platform: z.enum(['ios', 'android', 'web']), token: z.string().min(20).max(4096) }))
    .mutation(async ({ ctx, input }) => {
      const tokenHash = sha256(input.token);
      await ctx.db
        .insert(tables.deviceTokens)
        .values({ userId: ctx.user.id, platform: input.platform, token: encryptSecret(input.token), tokenHash, isActive: true, lastUsedAt: new Date() })
        .onConflictDoUpdate({
          target: [tables.deviceTokens.userId, tables.deviceTokens.tokenHash],
          set: { platform: input.platform, token: encryptSecret(input.token), isActive: true, lastUsedAt: new Date() },
        });
      return { ok: true as const };
    }),

  unregisterDeviceToken: protectedProcedure
    .input(z.object({ token: z.string().min(20).max(4096) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tables.deviceTokens)
        .set({ isActive: false })
        .where(and(eq(tables.deviceTokens.userId, ctx.user.id), eq(tables.deviceTokens.tokenHash, sha256(input.token))));
      return { ok: true as const };
    }),

  getPushPreferences: protectedProcedure.query(async ({ ctx }) => {
    await ensurePrefs(ctx.db, ctx.user.id);
    const [row] = await ctx.db
      .select({
        pushMessages: tables.pushPreferences.pushMessages,
        pushJobAlerts: tables.pushPreferences.pushJobAlerts,
        pushApplications: tables.pushPreferences.pushApplications,
        pushEndorsements: tables.pushPreferences.pushEndorsements,
        quietStartHour: tables.pushPreferences.quietStartHour,
        quietEndHour: tables.pushPreferences.quietEndHour,
      })
      .from(tables.pushPreferences)
      .where(eq(tables.pushPreferences.userId, ctx.user.id))
      .limit(1);
    return row ?? null;
  }),

  updatePushPreferences: protectedProcedure
    .input(
      z.object({
        pushMessages: z.boolean().optional(),
        pushJobAlerts: z.boolean().optional(),
        pushApplications: z.boolean().optional(),
        pushEndorsements: z.boolean().optional(),
        quietStartHour: hour.nullable().optional(),
        quietEndHour: hour.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePrefs(ctx.db, ctx.user.id);
      const set: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(input)) if (v !== undefined) set[k] = v;
      // Quiet hours are all-or-nothing.
      if ((input.quietStartHour === null) !== (input.quietEndHour === null) && ('quietStartHour' in input || 'quietEndHour' in input)) {
        if (input.quietStartHour === null) set.quietEndHour = null;
        if (input.quietEndHour === null) set.quietStartHour = null;
      }
      await ctx.db.update(tables.pushPreferences).set(set).where(eq(tables.pushPreferences.userId, ctx.user.id));
      return { ok: true as const };
    }),

  // In-app view of delivered pushes (also the app badge source).
  getNotifications: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: tables.pushNotifications.id,
        title: tables.pushNotifications.title,
        body: tables.pushNotifications.body,
        actionUrl: tables.pushNotifications.actionUrl,
        readAt: tables.pushNotifications.readAt,
        createdAt: tables.pushNotifications.createdAt,
      })
      .from(tables.pushNotifications)
      .where(eq(tables.pushNotifications.userId, ctx.user.id))
      .orderBy(desc(tables.pushNotifications.createdAt))
      .limit(input?.limit ?? 50);
  }),

  getBadgeCount: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ n: count() })
      .from(tables.pushNotifications)
      .where(and(eq(tables.pushNotifications.userId, ctx.user.id), isNull(tables.pushNotifications.readAt)));
    return { unread: row?.n ?? 0 };
  }),

  markNotificationRead: protectedProcedure.input(z.object({ id: z.string().uuid().optional() }).optional()).mutation(async ({ ctx, input }) => {
    const conds = [eq(tables.pushNotifications.userId, ctx.user.id), isNull(tables.pushNotifications.readAt)];
    if (input?.id) conds.push(eq(tables.pushNotifications.id, input.id));
    await ctx.db.update(tables.pushNotifications).set({ readAt: new Date() }).where(and(...conds));
    return { ok: true as const };
  }),
});
