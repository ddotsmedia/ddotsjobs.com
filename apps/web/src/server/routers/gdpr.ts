import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, tables } from '@ddotsjobs/db';
import { protectedProcedure, roleProcedure, router } from '../trpc.js';
import { gdprQueue } from '../queue.js';
import { logAction } from '@/lib/audit';
import { getSetting, isEnabled } from '@/lib/site-settings';

const adminProcedure = roleProcedure('admin', 'super_admin');

const ACTIVE_EXPORT = ['pending', 'processing'];

export const gdprRouter = router({
  // ── Data export ─────────────────────────────────────────────────────
  requestDataExport: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    // One in-flight export at a time.
    const [active] = await ctx.db
      .select({ id: tables.dataExportRequests.id })
      .from(tables.dataExportRequests)
      .where(and(eq(tables.dataExportRequests.userId, userId), inArray(tables.dataExportRequests.status, ACTIVE_EXPORT)))
      .limit(1);
    if (active) return { exportId: active.id, alreadyRunning: true as const };

    const [row] = await ctx.db
      .insert(tables.dataExportRequests)
      .values({ userId, status: 'pending' })
      .returning({ id: tables.dataExportRequests.id });
    await gdprQueue.add('export', { kind: 'export', exportId: row!.id, userId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 100 });
    await logAction(ctx, 'gdpr.export_requested', 'user', userId, { exportId: row!.id });
    return { exportId: row!.id, alreadyRunning: false as const };
  }),

  getExportStatus: protectedProcedure.input(z.object({ exportId: z.string().uuid().optional() }).optional()).query(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const conds = [eq(tables.dataExportRequests.userId, userId)];
    if (input?.exportId) conds.push(eq(tables.dataExportRequests.id, input.exportId));
    const [row] = await ctx.db
      .select({
        id: tables.dataExportRequests.id,
        status: tables.dataExportRequests.status,
        sizeBytes: tables.dataExportRequests.sizeBytes,
        requestedAt: tables.dataExportRequests.requestedAt,
        completedAt: tables.dataExportRequests.completedAt,
        expiresAt: tables.dataExportRequests.expiresAt,
      })
      .from(tables.dataExportRequests)
      .where(and(...conds))
      .orderBy(desc(tables.dataExportRequests.requestedAt))
      .limit(1);
    if (!row) return null;
    const expired = row.expiresAt ? row.expiresAt.getTime() < Date.now() : false;
    const downloadable = row.status === 'ready' && !expired;
    return { ...row, expired, downloadable, downloadUrl: downloadable ? `/api/gdpr/export/${row.id}` : null };
  }),

  // Returns the gated download URL (served by /api/gdpr/export/[id] with auth).
  downloadDataExport: protectedProcedure.input(z.object({ exportId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select({ id: tables.dataExportRequests.id, status: tables.dataExportRequests.status, expiresAt: tables.dataExportRequests.expiresAt })
      .from(tables.dataExportRequests)
      .where(and(eq(tables.dataExportRequests.id, input.exportId), eq(tables.dataExportRequests.userId, ctx.user.id)))
      .limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    if (row.status !== 'ready' || (row.expiresAt && row.expiresAt.getTime() < Date.now())) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Export not available' });
    return { url: `/api/gdpr/export/${row.id}` };
  }),

  // ── Right to be forgotten ────────────────────────────────────────────
  requestDataDeletion: protectedProcedure.input(z.object({ reason: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const [pending] = await ctx.db
      .select({ id: tables.dataDeletionRequests.id })
      .from(tables.dataDeletionRequests)
      .where(and(eq(tables.dataDeletionRequests.userId, userId), inArray(tables.dataDeletionRequests.status, ['pending', 'approved'])))
      .limit(1);
    if (pending) return { requestId: pending.id, status: 'pending' as const };

    const mode = (await getSetting('gdpr_delete_mode', 'soft')) === 'hard' ? 'hard' : 'soft';
    const autoApprove = await isEnabled('gdpr_auto_approve_deletion', false);
    const status = autoApprove ? 'approved' : 'pending';

    const [row] = await ctx.db
      .insert(tables.dataDeletionRequests)
      .values({ userId, reason: input.reason ?? null, mode, status, reviewedAt: autoApprove ? new Date() : null })
      .returning({ id: tables.dataDeletionRequests.id });

    await ctx.db.update(tables.users).set({ deletionRequestedAt: new Date() }).where(eq(tables.users.id, userId));
    await logAction(ctx, 'gdpr.deletion_requested', 'user', userId, { requestId: row!.id, mode, autoApprove });

    if (autoApprove) {
      await gdprQueue.add('deletion', { kind: 'deletion', deletionId: row!.id, userId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 100 });
    }
    return { requestId: row!.id, status: status as 'pending' | 'approved' };
  }),

  getDeletionStatus: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        id: tables.dataDeletionRequests.id,
        status: tables.dataDeletionRequests.status,
        mode: tables.dataDeletionRequests.mode,
        reason: tables.dataDeletionRequests.reason,
        requestedAt: tables.dataDeletionRequests.requestedAt,
        completedAt: tables.dataDeletionRequests.completedAt,
      })
      .from(tables.dataDeletionRequests)
      .where(eq(tables.dataDeletionRequests.userId, ctx.user.id))
      .orderBy(desc(tables.dataDeletionRequests.requestedAt))
      .limit(1);
    return row ?? null;
  }),

  // User views their own audit trail.
  viewAuditTrail: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).optional()).query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        action: tables.auditLog.action,
        entityType: tables.auditLog.entityType,
        ipAddress: tables.auditLog.ipAddress,
        userAgent: tables.auditLog.userAgent,
        createdAt: tables.auditLog.createdAt,
      })
      .from(tables.auditLog)
      .where(eq(tables.auditLog.actorUserId, ctx.user.id))
      .orderBy(desc(tables.auditLog.createdAt))
      .limit(input?.limit ?? 100);
  }),

  // ── Admin: deletion request queue ────────────────────────────────────
  listDeletionRequests: adminProcedure.input(z.object({ status: z.enum(['pending', 'approved', 'completed', 'denied', 'all']).default('pending') }).optional()).query(async ({ ctx, input }) => {
    const status = input?.status ?? 'pending';
    const dr = tables.dataDeletionRequests;
    const conds = status === 'all' ? [] : [eq(dr.status, status)];
    return ctx.db
      .select({
        id: dr.id,
        userId: dr.userId,
        userName: tables.users.nameEn,
        userPhone: tables.users.phone,
        status: dr.status,
        mode: dr.mode,
        reason: dr.reason,
        reviewNote: dr.reviewNote,
        requestedAt: dr.requestedAt,
        completedAt: dr.completedAt,
      })
      .from(dr)
      .leftJoin(tables.users, eq(tables.users.id, dr.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(dr.requestedAt))
      .limit(200);
  }),

  reviewDeletionRequest: adminProcedure
    .input(z.object({ requestId: z.string().uuid(), decision: z.enum(['approve', 'deny']), note: z.string().max(2000).optional(), mode: z.enum(['soft', 'hard']).optional() }))
    .mutation(async ({ ctx, input }) => {
      const dr = tables.dataDeletionRequests;
      const [req] = await ctx.db.select({ id: dr.id, userId: dr.userId, status: dr.status, mode: dr.mode }).from(dr).where(eq(dr.id, input.requestId)).limit(1);
      if (!req) throw new TRPCError({ code: 'NOT_FOUND' });
      if (req.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already reviewed' });

      if (input.decision === 'deny') {
        await ctx.db.update(dr).set({ status: 'denied', reviewedBy: ctx.user.id, reviewedAt: new Date(), reviewNote: input.note ?? null }).where(eq(dr.id, req.id));
        await logAction(ctx, 'gdpr.deletion_denied', 'user', req.userId, { requestId: req.id });
        return { ok: true as const, status: 'denied' as const };
      }

      const mode = input.mode ?? req.mode;
      await ctx.db.update(dr).set({ status: 'approved', mode, reviewedBy: ctx.user.id, reviewedAt: new Date(), reviewNote: input.note ?? null }).where(eq(dr.id, req.id));
      await gdprQueue.add('deletion', { kind: 'deletion', deletionId: req.id, userId: req.userId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 100 });
      await logAction(ctx, 'gdpr.deletion_approved', 'user', req.userId, { requestId: req.id, mode });
      return { ok: true as const, status: 'approved' as const };
    }),
});
