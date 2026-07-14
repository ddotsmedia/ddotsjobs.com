import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';

export const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const;

// FCM device registration tokens (encrypted). token_hash = sha256(plaintext).
export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 10 }).notNull(),
    token: text('token').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('device_tokens_user_hash_uq').on(t.userId, t.tokenHash),
    index('device_tokens_user_active_idx').on(t.userId, t.isActive),
  ],
);

// Delivered push notifications (also drives the app badge = count unread).
export const pushNotifications = pgTable(
  'push_notifications',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    actionUrl: text('action_url'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('push_notifications_user_created_idx').on(t.userId, t.createdAt)],
);

// Per-user push toggles + quiet hours (IST hour-of-day).
export const pushPreferences = pgTable(
  'push_preferences',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pushMessages: boolean('push_messages').notNull().default(true),
    pushJobAlerts: boolean('push_job_alerts').notNull().default(true),
    pushApplications: boolean('push_applications').notNull().default(true),
    pushEndorsements: boolean('push_endorsements').notNull().default(true),
    quietStartHour: smallint('quiet_start_hour'),
    quietEndHour: smallint('quiet_end_hour'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [uniqueIndex('push_preferences_user_uq').on(t.userId)],
);
