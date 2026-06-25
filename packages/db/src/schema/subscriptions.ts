import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pk, timestamps } from './_shared.js';
import { paymentStatus, subscriptionTier } from './enums.js';
import { users } from './users.js';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    tier: subscriptionTier('tier').notNull().default('free'),
    // paise (integer). BIGINT.
    pricePaise: bigint('price_paise', { mode: 'number' }).notNull().default(0),
    razorpaySubscriptionId: varchar('razorpay_subscription_id', { length: 80 }),
    status: varchar('status', { length: 30 }).notNull().default('active'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: jsonb('cancel_at_period_end').$type<boolean>().notNull().default(false),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('subscriptions_user_idx').on(t.userId),
    index('subscriptions_tier_idx').on(t.tier),
    uniqueIndex('subscriptions_razorpay_uq')
      .on(t.razorpaySubscriptionId)
      .where(sql`razorpay_subscription_id IS NOT NULL`),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),
    // paise (integer). BIGINT. Always store amount in paise.
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    status: paymentStatus('status').notNull().default('created'),
    razorpayOrderId: varchar('razorpay_order_id', { length: 80 }),
    razorpayPaymentId: varchar('razorpay_payment_id', { length: 80 }),
    razorpaySignature: text('razorpay_signature'),
    purpose: varchar('purpose', { length: 60 }).notNull().default('subscription'),
    refundedAmountPaise: bigint('refunded_amount_paise', { mode: 'number' }).notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('payments_user_idx').on(t.userId),
    index('payments_status_idx').on(t.status),
    uniqueIndex('payments_razorpay_order_uq')
      .on(t.razorpayOrderId)
      .where(sql`razorpay_order_id IS NOT NULL`),
    uniqueIndex('payments_razorpay_payment_uq')
      .on(t.razorpayPaymentId)
      .where(sql`razorpay_payment_id IS NOT NULL`),
  ],
);
