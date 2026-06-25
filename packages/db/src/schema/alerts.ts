import { sql } from 'drizzle-orm';
import {
  boolean,
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
import { alertChannel, alertFrequency } from './enums.js';
import { jobs } from './jobs.js';
import { users } from './users.js';

export const alertSubscriptions = pgTable(
  'alert_subscriptions',
  {
    id: pk(),
    seekerUserId: uuid('seeker_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    labelMl: varchar('label_ml', { length: 200 }),
    labelEn: varchar('label_en', { length: 200 }),
    channel: alertChannel('channel').notNull().default('whatsapp'),
    frequency: alertFrequency('frequency').notNull().default('daily'),
    isActive: boolean('is_active').notNull().default(true),
    lastDispatchedAt: timestamp('last_dispatched_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('alert_subs_seeker_idx').on(t.seekerUserId),
    index('alert_subs_active_idx').on(t.isActive),
  ],
);

// Individual filter criteria (AND-combined) for an alert subscription.
export const alertFilters = pgTable(
  'alert_filters',
  {
    id: pk(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => alertSubscriptions.id, { onDelete: 'cascade' }),
    // e.g. 'district', 'category', 'job_type', 'salary_min', 'keyword'
    field: varchar('field', { length: 60 }).notNull(),
    operator: varchar('operator', { length: 20 }).notNull().default('eq'),
    value: jsonb('value').$type<unknown>().notNull(),
    ...timestamps,
  },
  (t) => [index('alert_filters_subscription_idx').on(t.subscriptionId)],
);

// Append-only log of dispatched alerts (idempotency + analytics).
export const alertDispatchLog = pgTable(
  'alert_dispatch_log',
  {
    id: pk(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => alertSubscriptions.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    channel: alertChannel('channel').notNull(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    deliveryStatus: varchar('delivery_status', { length: 30 }).notNull().default('queued'),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    ...timestamps,
  },
  (t) => [
    index('alert_dispatch_subscription_idx').on(t.subscriptionId),
    // Idempotency: one dispatch per (subscription, job, channel).
    uniqueIndex('alert_dispatch_uq')
      .on(t.subscriptionId, t.jobId, t.channel)
      .where(sql`deleted_at IS NULL`),
  ],
);
