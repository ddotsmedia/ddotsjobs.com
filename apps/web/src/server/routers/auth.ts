import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { isNull, tables } from '@ddotsjobs/db';
import {
  clearOtp,
  deleteSession,
  generateOtp,
  markVerified,
  readOtp,
  storeOtp,
} from '@/lib/otp';
import { sendOtp } from '@/lib/resend';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

const phoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, 'Enter a valid +91 mobile number');

export const authRouter = router({
  // ── Step 1: issue OTP ──────────────────────────────────────────────
  requestOtp: publicProcedure
    .input(z.object({ phone: phoneSchema }))
    .mutation(async ({ input }) => {
      const code = generateOtp();
      await storeOtp(input.phone, code);
      await sendOtp(input.phone, code);
      return { success: true as const };
    }),

  // ── Step 2: verify OTP, upsert user, write sign-in handoff ─────────
  verifyOtp: publicProcedure
    .input(z.object({ phone: phoneSchema, otp: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const stored = await readOtp(input.phone);
      if (!stored || stored !== input.otp) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired OTP' });
      }
      await clearOtp(input.phone);

      const now = new Date();
      const [user] = await ctx.db
        .insert(tables.users)
        .values({
          phone: input.phone,
          role: 'seeker',
          phoneVerified: true,
          phoneVerifiedAt: now,
          lastLoginAt: now,
        })
        .onConflictDoUpdate({
          target: tables.users.phone,
          targetWhere: isNull(tables.users.deletedAt),
          set: { phoneVerified: true, phoneVerifiedAt: now, lastLoginAt: now, updatedAt: now },
        })
        .returning({ id: tables.users.id, role: tables.users.role });

      if (!user) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'User upsert failed' });
      }

      // Single-use handoff: Credentials provider mints the JWT from this.
      await markVerified(input.phone, user.id);
      return { success: true as const };
    }),

  // ── Sign out: drop the server-side session record ──────────────────
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteSession(ctx.user.id);
    return { success: true as const };
  }),
});
