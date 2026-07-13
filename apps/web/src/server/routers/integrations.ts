import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, tables, type Database } from '@ddotsjobs/db';
import { encryptJson } from '@ddotsjobs/config/crypto';
import { roleProcedure, router } from '../trpc.js';
import { integrationQueue } from '../queue.js';
import { PROVIDER_NAMES, providerConfigSchema, providerMeta, maskMeta, type ProviderName } from '@/lib/integration-providers';

const emp = roleProcedure('employer');
const INTEGRATION_EVENTS = ['job_posted', 'application_received', 'offer_sent'] as const;

async function employerId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: tables.employers.id })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

async function ownIntegration(db: Database, empId: string, integrationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tables.integrations.id })
    .from(tables.integrations)
    .where(and(eq(tables.integrations.id, integrationId), eq(tables.integrations.employerId, empId)))
    .limit(1);
  return Boolean(row);
}

export const integrationsRouter = router({
  getIntegrations: emp.query(async ({ ctx }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId) return [];
    const rows = await ctx.db
      .select({
        id: tables.integrations.id,
        providerName: tables.integrations.providerName,
        isConnected: tables.integrations.isConnected,
        meta: tables.integrations.meta,
        lastError: tables.integrations.lastError,
        lastSyncedAt: tables.integrations.lastSyncedAt,
        createdAt: tables.integrations.createdAt,
      })
      .from(tables.integrations)
      .where(eq(tables.integrations.employerId, empId))
      .orderBy(desc(tables.integrations.createdAt));

    // All event toggles for this employer's integrations, in one pass.
    const allEvents = rows.length
      ? await ctx.db
          .select({ integrationId: tables.integrationEvents.integrationId, eventType: tables.integrationEvents.eventType, isPushEnabled: tables.integrationEvents.isPushEnabled })
          .from(tables.integrationEvents)
          .innerJoin(tables.integrations, eq(tables.integrations.id, tables.integrationEvents.integrationId))
          .where(eq(tables.integrations.employerId, empId))
      : [];

    return rows.map((r) => ({
      ...r,
      events: allEvents.filter((e) => e.integrationId === r.id).map((e) => ({ eventType: e.eventType, enabled: e.isPushEnabled })),
    }));
  }),

  connectIntegration: emp
    .input(z.object({ providerName: z.enum(PROVIDER_NAMES), config: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const empId = await employerId(ctx.db, ctx.user.id);
      if (!empId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Register your company first' });

      const meta = providerMeta(input.providerName as ProviderName);
      if (!meta?.connectable) throw new TRPCError({ code: 'BAD_REQUEST', message: `${meta?.label ?? input.providerName} is not available yet` });

      const schema = providerConfigSchema(input.providerName as ProviderName);
      if (!schema) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported provider' });
      const parsed = schema.safeParse(input.config);
      if (!parsed.success) throw new TRPCError({ code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid credentials' });

      const encrypted = encryptJson(parsed.data);
      const displayMeta = maskMeta(input.providerName as ProviderName, parsed.data as Record<string, unknown>);

      const [row] = await ctx.db
        .insert(tables.integrations)
        .values({ employerId: empId, providerName: input.providerName, isConnected: true, accessToken: encrypted, meta: displayMeta, lastError: null })
        .onConflictDoUpdate({
          target: [tables.integrations.employerId, tables.integrations.providerName],
          set: { isConnected: true, accessToken: encrypted, meta: displayMeta, lastError: null, updatedAt: new Date() },
        })
        .returning({ id: tables.integrations.id });

      // Seed event toggles (default all enabled) without clobbering existing ones.
      await ctx.db
        .insert(tables.integrationEvents)
        .values(INTEGRATION_EVENTS.map((e) => ({ integrationId: row!.id, eventType: e, isPushEnabled: true })))
        .onConflictDoNothing();

      return { ok: true as const, id: row!.id };
    }),

  disconnectIntegration: emp.input(z.object({ integrationId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId || !(await ownIntegration(ctx.db, empId, input.integrationId))) throw new TRPCError({ code: 'FORBIDDEN' });
    // Delete revokes: credentials removed, event toggles cascade away.
    await ctx.db.delete(tables.integrations).where(and(eq(tables.integrations.id, input.integrationId), eq(tables.integrations.employerId, empId)));
    return { ok: true as const };
  }),

  toggleIntegrationEvent: emp
    .input(z.object({ integrationId: z.string().uuid(), eventType: z.enum(INTEGRATION_EVENTS), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const empId = await employerId(ctx.db, ctx.user.id);
      if (!empId || !(await ownIntegration(ctx.db, empId, input.integrationId))) throw new TRPCError({ code: 'FORBIDDEN' });
      await ctx.db
        .insert(tables.integrationEvents)
        .values({ integrationId: input.integrationId, eventType: input.eventType, isPushEnabled: input.enabled })
        .onConflictDoUpdate({ target: [tables.integrationEvents.integrationId, tables.integrationEvents.eventType], set: { isPushEnabled: input.enabled } });
      return { ok: true as const };
    }),

  testIntegration: emp.input(z.object({ integrationId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const empId = await employerId(ctx.db, ctx.user.id);
    if (!empId || !(await ownIntegration(ctx.db, empId, input.integrationId))) throw new TRPCError({ code: 'FORBIDDEN' });
    await integrationQueue.add(
      'push',
      { integrationId: input.integrationId, event: 'job_posted', data: { jobId: 'test', title: 'Test job from ddotsjobs', url: 'https://ddotsjobs.com' } },
      { attempts: 2, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50 },
    );
    return { queued: true as const };
  }),
});
