import { eq, tables } from '@ddotsjobs/db';
import { protectedProcedure, router } from '../trpc.js';

export const accountRouter = router({
  // GDPR-style erasure request. Flags the account; an operator processes the
  // actual soft-deletion within 30 days.
  requestDeletion: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(tables.users)
      .set({ deletionRequestedAt: new Date() })
      .where(eq(tables.users.id, ctx.user.id));
    await ctx.db.insert(tables.auditLog).values({
      actorUserId: ctx.user.id,
      action: 'account.deletion_requested',
      entityType: 'user',
      entityId: ctx.user.id,
    });
    return { success: true as const, message: 'Deletion requested. Processed within 30 days.' };
  }),
});
