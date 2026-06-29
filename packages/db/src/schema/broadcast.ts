import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';

// Admin WhatsApp broadcast records (queued / scheduled / sent / cancelled / failed).
export const broadcastLog = pgTable(
  'broadcast_log',
  {
    id: pk(),
    message: text('message').notNull(),
    targetGroups: text('target_groups').array().notNull(),
    broadcastType: text('broadcast_type').notNull().default('announcement'),
    status: text('status').notNull().default('queued'),
    estimatedReach: integer('estimated_reach').notNull().default(0),
    actualReach: integer('actual_reach').notNull().default(0),
    sentByUserId: uuid('sent_by_user_id').references(() => users.id),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    errorMessage: text('error_message'),
  },
  (t) => [index('broadcast_log_created_idx').on(t.createdAt)],
);
