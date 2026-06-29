import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, createNotification, desc, eq, isNull, tables, type Database } from '@ddotsjobs/db';
import { roleProcedure, publicProcedure, router } from '../trpc.js';
import { PLANS, publicPlans } from '@/lib/plans';
import { isEnabled } from '@/lib/site-settings';

const employerProc = roleProcedure('employer');
const paidTierSchema = z.enum(['employer_starter', 'employer_growth', 'hospital_pro', 'agency']);

async function requireEmployerId(db: Database, userId: string): Promise<string> {
  const [row] = await db
    .select({ id: tables.employers.id })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'FORBIDDEN', message: 'No employer profile' });
  return row.id;
}

export const billingRouter = router({
  plans: publicProcedure.query(() => publicPlans()),

  createOrder: employerProc
    .input(z.object({ tier: paidTierSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isEnabled('payment_enabled', false))) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Payments are not yet configured. Contact admin.' });
      }
      const employerId = await requireEmployerId(ctx.db, ctx.user.id);
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Payments are not configured yet' });
      }
      const plan = PLANS[input.tier];
      const rz = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const order = await rz.orders.create({
        amount: plan.pricePaise,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
        notes: { employer_id: employerId, tier: input.tier },
      });
      return { orderId: order.id, amount: plan.pricePaise, currency: 'INR' as const, keyId };
    }),

  verifyPayment: employerProc
    .input(
      z.object({
        orderId: z.string(),
        paymentId: z.string(),
        signature: z.string(),
        tier: paidTierSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Payments are not configured' });

      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${input.orderId}|${input.paymentId}`)
        .digest('hex');
      if (expected !== input.signature) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid signature' });
      }

      const employerId = await requireEmployerId(ctx.db, ctx.user.id);
      const plan = PLANS[input.tier];
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const gstAmountPaise = Math.round(plan.pricePaise * 0.18);

      const [sub] = await ctx.db
        .insert(tables.subscriptions)
        .values({
          userId: ctx.user.id,
          employerId,
          tier: input.tier,
          status: 'active',
          pricePaise: plan.pricePaise,
          jobsPerPeriod: plan.jobsPerPeriod,
          talentPoolAccess: plan.talentPoolAccess,
          knmcFilterAccess: plan.knmcFilterAccess,
          whatsappPushPerMonth: plan.whatsappPushPerMonth,
          walkInNoticesPerMonth: plan.walkInNoticesPerMonth,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        })
        .returning({ id: tables.subscriptions.id });

      await ctx.db.insert(tables.payments).values({
        userId: ctx.user.id,
        employerId,
        subscriptionId: sub?.id ?? null,
        amountPaise: plan.pricePaise,
        currency: 'INR',
        status: 'captured', // enum has no 'success'; 'captured' = paid
        razorpayOrderId: input.orderId,
        razorpayPaymentId: input.paymentId,
        razorpaySignature: input.signature,
        purpose: 'subscription',
        gstAmountPaise,
        gstRatePct: 18,
        paidAt: now,
        capturedAt: now,
      });

      await ctx.db
        .update(tables.employers)
        .set({ subscriptionTier: input.tier, jobsLimitThisPeriod: plan.jobsPerPeriod, jobsPostedThisPeriod: 0 })
        .where(eq(tables.employers.id, employerId));

      await createNotification({
        userId: ctx.user.id,
        type: 'subscription.activated',
        title: `${plan.name} plan activated`,
        titleMl: `${plan.name} plan active ആയി`,
        body: `Your ${plan.name} subscription is active until ${periodEnd.toLocaleDateString('en-IN')}.`,
        actionUrl: '/employer/billing',
      });

      return { success: true as const, tier: input.tier };
    }),

  mySubscription: employerProc.query(async ({ ctx }) => {
    const employerId = await requireEmployerId(ctx.db, ctx.user.id);
    const [row] = await ctx.db
      .select({
        id: tables.subscriptions.id,
        tier: tables.subscriptions.tier,
        status: tables.subscriptions.status,
        pricePaise: tables.subscriptions.pricePaise,
        currentPeriodEnd: tables.subscriptions.currentPeriodEnd,
        employerTier: tables.employers.subscriptionTier,
        jobsPosted: tables.employers.jobsPostedThisPeriod,
        jobsLimit: tables.employers.jobsLimitThisPeriod,
      })
      .from(tables.subscriptions)
      .innerJoin(tables.employers, eq(tables.employers.id, tables.subscriptions.employerId))
      .where(and(eq(tables.subscriptions.employerId, employerId), eq(tables.subscriptions.status, 'active')))
      .orderBy(desc(tables.subscriptions.createdAt))
      .limit(1);

    if (!row) {
      const [emp] = await ctx.db
        .select({ tier: tables.employers.subscriptionTier, jobsPosted: tables.employers.jobsPostedThisPeriod, jobsLimit: tables.employers.jobsLimitThisPeriod })
        .from(tables.employers)
        .where(eq(tables.employers.id, employerId))
        .limit(1);
      return {
        active: false as const,
        tier: emp?.tier ?? 'free',
        jobsPosted: emp?.jobsPosted ?? 0,
        jobsLimit: emp?.jobsLimit ?? 3,
        currentPeriodEnd: null,
      };
    }
    return {
      active: true as const,
      tier: row.tier,
      jobsPosted: row.jobsPosted,
      jobsLimit: row.jobsLimit,
      currentPeriodEnd: row.currentPeriodEnd,
    };
  }),

  history: employerProc.query(async ({ ctx }) => {
    const employerId = await requireEmployerId(ctx.db, ctx.user.id);
    return ctx.db
      .select({
        id: tables.payments.id,
        amountPaise: tables.payments.amountPaise,
        gstAmountPaise: tables.payments.gstAmountPaise,
        status: tables.payments.status,
        paidAt: tables.payments.paidAt,
        createdAt: tables.payments.createdAt,
        tier: tables.subscriptions.tier,
      })
      .from(tables.payments)
      .leftJoin(tables.subscriptions, eq(tables.subscriptions.id, tables.payments.subscriptionId))
      .where(eq(tables.payments.employerId, employerId))
      .orderBy(desc(tables.payments.createdAt))
      .limit(20);
  }),

  cancelSubscription: employerProc.mutation(async ({ ctx }) => {
    const employerId = await requireEmployerId(ctx.db, ctx.user.id);
    await ctx.db
      .update(tables.subscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(and(eq(tables.subscriptions.employerId, employerId), eq(tables.subscriptions.status, 'active')));
    await ctx.db
      .update(tables.employers)
      .set({ subscriptionTier: 'free', jobsLimitThisPeriod: 3 })
      .where(eq(tables.employers.id, employerId));
    return { cancelled: true as const };
  }),
});
