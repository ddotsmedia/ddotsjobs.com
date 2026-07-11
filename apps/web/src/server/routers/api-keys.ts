import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, tables, type Database } from '@ddotsjobs/db';
import { roleProcedure, router } from '../trpc.js';
import { generateApiKey } from '@/lib/api-auth';

const emp = roleProcedure('employer');

async function employerId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: tables.employers.id })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

export const apiKeysRouter = router({
  // Create a key. The raw key is returned ONCE and never stored.
  generateApiKey: emp
    .input(z.object({ label: z.string().max(100).optional() }))
    .mutation(async ({ ctx, input }) => {
      const id = await employerId(ctx.db, ctx.user.id);
      if (!id) throw new TRPCError({ code: 'NOT_FOUND', message: 'Register your company first' });
      const { key, hash, prefix } = generateApiKey();
      await ctx.db.insert(tables.apiKeys).values({ employerId: id, keyHash: hash, keyPrefix: prefix, label: input.label ?? null });
      return { key }; // show once
    }),

  listApiKeys: emp.query(async ({ ctx }) => {
    const id = await employerId(ctx.db, ctx.user.id);
    if (!id) return [];
    return ctx.db
      .select({
        id: tables.apiKeys.id,
        prefix: tables.apiKeys.keyPrefix,
        label: tables.apiKeys.label,
        lastUsedAt: tables.apiKeys.lastUsedAt,
        createdAt: tables.apiKeys.createdAt,
        revokedAt: tables.apiKeys.revokedAt,
      })
      .from(tables.apiKeys)
      .where(eq(tables.apiKeys.employerId, id))
      .orderBy(desc(tables.apiKeys.createdAt));
  }),

  revokeApiKey: emp
    .input(z.object({ keyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const id = await employerId(ctx.db, ctx.user.id);
      if (!id) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.db
        .update(tables.apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(tables.apiKeys.id, input.keyId), eq(tables.apiKeys.employerId, id)));
      return { ok: true as const };
    }),
});
