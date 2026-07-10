import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';
import { jobs } from './jobs.js';

// Shareable referral links. One per (user, job); job_id null = generic link.
export const referralLinks = pgTable(
  'referral_links',
  {
    id: pk(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    referralCode: varchar('referral_code', { length: 20 }).notNull(),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    clickCount: integer('click_count').notNull().default(0),
    applyCount: integer('apply_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('referral_links_code_uq').on(t.referralCode),
    uniqueIndex('referral_links_user_job_uq').on(t.userId, t.jobId),
    index('referral_links_user_idx').on(t.userId),
    index('referral_links_job_idx').on(t.jobId, t.createdAt),
  ],
);

// Signed credit ledger. Balance = SUM(amount) per user.
export const referralCredits = pgTable(
  'referral_credits',
  {
    id: pk(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    transactionType: varchar('transaction_type', { length: 20 }).notNull(),
    amount: integer('amount').notNull(),
    relatedUserId: uuid('related_user_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('referral_credits_user_idx').on(t.userId, t.createdAt)],
);

export const referralRedemptions = pgTable(
  'referral_redemptions',
  {
    id: pk(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    redemptionType: varchar('redemption_type', { length: 30 }).notNull(),
    creditsUsed: integer('credits_used').notNull(),
    status: varchar('status', { length: 15 }).notNull().default('redeemed'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('referral_redemptions_user_idx').on(t.userId, t.createdAt)],
);
