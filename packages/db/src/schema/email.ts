import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';

// Per-user email notification preferences. All types default on, but the global
// `email_notifications_active` site setting (default off) gates every send.
// See migration 0033.
export const emailPreferences = pgTable(
  'email_preferences',
  {
    id: pk(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    notifyOnMessages: boolean('notify_on_messages').notNull().default(true),
    notifyOnJobAlerts: boolean('notify_on_job_alerts').notNull().default(true),
    notifyOnExpiry: boolean('notify_on_expiry').notNull().default(true),
    notifyOnApplications: boolean('notify_on_applications').notNull().default(true),
    notifyOnEndorsements: boolean('notify_on_endorsements').notNull().default(true),
    digestFrequency: varchar('digest_frequency', { length: 10 }).notNull().default('daily'),
    unsubscribeToken: uuid('unsubscribe_token').notNull().default(sql`gen_random_uuid()`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('email_preferences_user_uq').on(t.userId),
    uniqueIndex('email_preferences_token_uq').on(t.unsubscribeToken),
  ],
);

// Append-only log of every email send attempt (sent | failed | skipped).
export const emailLogs = pgTable(
  'email_logs',
  {
    id: pk(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    subject: text('subject').notNull(),
    status: varchar('status', { length: 10 }).notNull(),
    bounceReason: text('bounce_reason'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('email_logs_user_idx').on(t.userId), index('email_logs_event_idx').on(t.eventType, t.sentAt)],
);
