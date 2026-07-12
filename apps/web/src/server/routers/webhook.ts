import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, isNull, tables, type Database } from '@ddotsjobs/db';
import { roleProcedure, router } from '../trpc.js';
import { webhookQueue } from '../queue.js';

const emp = roleProcedure('employer');
const MAX_WEBHOOKS = 100;
const EVENTS = ['job_posted', 'application_received', 'application_stage_changed', 'offer_sent', 'application_rejected'] as const;

const httpsUrl = z.string().url().max(500).refine((u) => u.startsWith('https://'), { message: 'URL must be HTTPS' });
const eventsInput = z.array(z.enum(EVENTS)).min(1).max(EVENTS.length);

function newSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

async function employerId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db.select({ id: tables.employers.id }).from(tables.employers).where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt))).limit(1);
  return row?.id ?? null;
}

async function ownWebhook(db: Database, empId: string, webhookId: string): Promise<boolean> {
  const [row] = await db.select({ id: tables.webhooks.id }).from(tables.webhooks).where(and(eq(tables.webhooks.id, webhookId), eq(tables.webhooks.employerId, empId))).limit(1);
  return Boolean(row);
}

export const webhookRouter = router({
  createWebhook: emp
    .input(z.object({ url: httpsUrl, events: eventsInput }))
    .mutation(async ({ ctx, input }) => {
      const id = await employerId(ctx.db, ctx.user.id);
      if (!id) throw new TRPCError({ code: 'NOT_FOUND', message: 'Register your company first' });
      const [c] = await ctx.db.select({ n: count() }).from(tables.webhooks).where(eq(tables.webhooks.employerId, id));
      if ((c?.n ?? 0) >= MAX_WEBHOOKS) throw new TRPCError({ code: 'FORBIDDEN', message: `Max ${MAX_WEBHOOKS} webhooks` });
      const secret = newSecret();
      const [row] = await ctx.db.insert(tables.webhooks).values({ employerId: id, url: input.url, events: input.events, secret }).returning({ id: tables.webhooks.id });
      return { id: row!.id, secret };
    }),

  getWebhooks: emp.query(async ({ ctx }) => {
    const id = await employerId(ctx.db, ctx.user.id);
    if (!id) return [];
    return ctx.db
      .select({ id: tables.webhooks.id, url: tables.webhooks.url, events: tables.webhooks.events, secret: tables.webhooks.secret, isActive: tables.webhooks.isActive, lastTriggeredAt: tables.webhooks.lastTriggeredAt, createdAt: tables.webhooks.createdAt })
      .from(tables.webhooks)
      .where(eq(tables.webhooks.employerId, id))
      .orderBy(desc(tables.webhooks.createdAt));
  }),

  updateWebhook: emp
    .input(z.object({ webhookId: z.string().uuid(), url: httpsUrl.optional(), events: eventsInput.optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const id = await employerId(ctx.db, ctx.user.id);
      if (!id || !(await ownWebhook(ctx.db, id, input.webhookId))) throw new TRPCError({ code: 'FORBIDDEN' });
      const set: Record<string, unknown> = {};
      if (input.url !== undefined) set.url = input.url;
      if (input.events !== undefined) set.events = input.events;
      if (input.isActive !== undefined) set.isActive = input.isActive;
      if (Object.keys(set).length) await ctx.db.update(tables.webhooks).set(set).where(eq(tables.webhooks.id, input.webhookId));
      return { ok: true as const };
    }),

  deleteWebhook: emp
    .input(z.object({ webhookId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const id = await employerId(ctx.db, ctx.user.id);
      if (!id) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.db.delete(tables.webhooks).where(and(eq(tables.webhooks.id, input.webhookId), eq(tables.webhooks.employerId, id)));
      return { ok: true as const };
    }),

  getWebhookLogs: emp
    .input(z.object({ webhookId: z.string().uuid(), limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const id = await employerId(ctx.db, ctx.user.id);
      if (!id || !(await ownWebhook(ctx.db, id, input.webhookId))) throw new TRPCError({ code: 'FORBIDDEN' });
      return ctx.db
        .select({ id: tables.webhookLogs.id, eventType: tables.webhookLogs.eventType, statusCode: tables.webhookLogs.statusCode, response: tables.webhookLogs.response, retries: tables.webhookLogs.retries, succeededAt: tables.webhookLogs.succeededAt, failedAt: tables.webhookLogs.failedAt, createdAt: tables.webhookLogs.createdAt })
        .from(tables.webhookLogs)
        .where(eq(tables.webhookLogs.webhookId, input.webhookId))
        .orderBy(desc(tables.webhookLogs.createdAt))
        .limit(input.limit);
    }),

  testWebhook: emp
    .input(z.object({ webhookId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const id = await employerId(ctx.db, ctx.user.id);
      if (!id || !(await ownWebhook(ctx.db, id, input.webhookId))) throw new TRPCError({ code: 'FORBIDDEN' });
      await webhookQueue.add(
        'deliver',
        { webhookId: input.webhookId, event: 'test', timestamp: new Date().toISOString(), data: { message: 'This is a test event from ddotsjobs.' } },
        { attempts: 2, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true, removeOnFail: 50 },
      );
      return { queued: true as const };
    }),

  rotateWebhookSecret: emp
    .input(z.object({ webhookId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const id = await employerId(ctx.db, ctx.user.id);
      if (!id || !(await ownWebhook(ctx.db, id, input.webhookId))) throw new TRPCError({ code: 'FORBIDDEN' });
      const secret = newSecret();
      await ctx.db.update(tables.webhooks).set({ secret }).where(eq(tables.webhooks.id, input.webhookId));
      return { secret };
    }),
});
