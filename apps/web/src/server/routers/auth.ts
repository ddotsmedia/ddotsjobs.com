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
import { sendWhatsAppOtp } from '@/lib/greenapi';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

// E.164 international: + then 8–15 digits, leading digit non-zero.
const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid mobile number with country code');

export const authRouter = router({
  // ── Step 1: issue OTP ──────────────────────────────────────────────
  requestOtp: publicProcedure
    .input(z.object({ phone: phoneSchema }))
    .mutation(async ({ ctx, input }) => {
      // Blocked after repeated failed verifications?
      if (await ctx.redis.get(`otp:blocked:${input.phone}`)) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again in an hour.' });
      }
      // Max 5 OTP requests per phone per hour.
      const rlKey = `otp:ratelimit:${input.phone}`;
      const n = await ctx.redis.incr(rlKey);
      if (n === 1) await ctx.redis.expire(rlKey, 3600);
      if (n > 5) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many OTP requests. Try again later.' });
      }
      const code = generateOtp();
      await storeOtp(input.phone, code);
      await sendWhatsAppOtp(input.phone, code);
      return { success: true as const };
    }),

  // ── Step 2: verify OTP, upsert user, write sign-in handoff ─────────
  verifyOtp: publicProcedure
    .input(z.object({ phone: phoneSchema, otp: z.string().length(6).regex(/^\d+$/, 'OTP must be 6 digits') }))
    .mutation(async ({ ctx, input }) => {
      if (await ctx.redis.get(`otp:blocked:${input.phone}`)) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many failed attempts. Try again in an hour.' });
      }
      const stored = await readOtp(input.phone);
      if (!stored || stored !== input.otp) {
        // Track failed attempts; block the phone for 1 hour after 5 fails.
        const fk = `otp:fails:${input.phone}`;
        const fails = await ctx.redis.incr(fk);
        if (fails === 1) await ctx.redis.expire(fk, 3600);
        if (fails >= 5) await ctx.redis.set(`otp:blocked:${input.phone}`, '1', 'EX', 3600);
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired OTP' });
      }
      await clearOtp(input.phone);
      await ctx.redis.del(`otp:fails:${input.phone}`);

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
