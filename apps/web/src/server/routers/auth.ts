import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { and, eq, isNull, tables } from '@ddotsjobs/db';
import {
  clearOtp,
  deleteSession,
  generateOtp,
  markVerified,
  readOtp,
  storeOtp,
} from '@/lib/otp';
import { sendWhatsAppOtp } from '@/lib/greenapi';
import { isEnabled } from '@/lib/site-settings';
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
      // Block NEW sign-ups when registrations are paused (existing users still log in).
      const [existing] = await ctx.db
        .select({ id: tables.users.id })
        .from(tables.users)
        .where(and(eq(tables.users.phone, input.phone), isNull(tables.users.deletedAt)))
        .limit(1);
      if (!existing && !(await isEnabled('new_registrations_open', true))) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'New registrations are temporarily paused.' });
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

  // ── Admin username/password login (alternative to OTP) ─────────────
  adminLogin: publicProcedure
    .input(z.object({ username: z.string().min(3).max(50), password: z.string().min(8).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const key = `admin:login:${input.username.toLowerCase()}`;
      const attempts = await ctx.redis.incr(key);
      if (attempts === 1) await ctx.redis.expire(key, 900);
      if (attempts > 5) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Wait 15 minutes.' });
      }

      const [user] = await ctx.db
        .select({ id: tables.users.id, role: tables.users.role, phone: tables.users.phone, hash: tables.users.adminPasswordHash })
        .from(tables.users)
        .where(and(eq(tables.users.adminUsername, input.username), isNull(tables.users.deletedAt), eq(tables.users.isBanned, false)))
        .limit(1);

      const ok =
        user && (user.role === 'admin' || user.role === 'super_admin') && user.hash
          ? await bcrypt.compare(input.password, user.hash)
          : false;

      if (!ok || !user) {
        if (user) {
          await ctx.db.insert(tables.auditLog).values({ actorUserId: user.id, action: 'admin_login_failed', entityType: 'user', entityId: user.id });
        }
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid username or password' });
      }

      await ctx.redis.del(key);
      await ctx.db.insert(tables.auditLog).values({
        actorUserId: user.id,
        action: 'admin_login_success',
        entityType: 'user',
        entityId: user.id,
        diff: { username: input.username },
      });
      // Reuse the OTP single-use handoff — client completes via signIn('otp', { phone }).
      await markVerified(user.phone, user.id);
      return { success: true as const, phone: user.phone, redirectTo: '/admin/dashboard' };
    }),

  changeAdminPassword: protectedProcedure
    .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.role as string;
      if (role !== 'admin' && role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const [u] = await ctx.db
        .select({ hash: tables.users.adminPasswordHash })
        .from(tables.users)
        .where(eq(tables.users.id, ctx.user.id))
        .limit(1);
      if (!u?.hash || !(await bcrypt.compare(input.currentPassword, u.hash))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
      }
      const hash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.update(tables.users).set({ adminPasswordHash: hash }).where(eq(tables.users.id, ctx.user.id));
      await ctx.db.insert(tables.auditLog).values({ actorUserId: ctx.user.id, action: 'admin_password_changed', entityType: 'user', entityId: ctx.user.id });
      return { success: true as const };
    }),

  // ── Sign out: drop the server-side session record ──────────────────
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteSession(ctx.user.id);
    return { success: true as const };
  }),
});
