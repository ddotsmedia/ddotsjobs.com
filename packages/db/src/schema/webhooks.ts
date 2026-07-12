import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { employers } from './employers.js';

export const WEBHOOK_EVENTS = [
  'job_posted',
  'application_received',
  'application_stage_changed',
  'offer_sent',
  'application_rejected',
] as const;

export const webhooks = pgTable(
  'webhooks',
  {
    id: pk(),
    employerId: uuid('employer_id').notNull().references(() => employers.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    events: text('events').array().notNull().default(sql`'{}'`),
    secret: varchar('secret', { length: 80 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  },
  (t) => [index('webhooks_employer_idx').on(t.employerId)],
);

export const webhookLogs = pgTable(
  'webhook_logs',
  {
    id: pk(),
    webhookId: uuid('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    statusCode: integer('status_code'),
    response: text('response'),
    retries: integer('retries').notNull().default(0),
    succeededAt: timestamp('succeeded_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('webhook_logs_webhook_idx').on(t.webhookId, t.createdAt)],
);
