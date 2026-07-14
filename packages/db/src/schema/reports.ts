import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { employers } from './employers.js';

export const REPORT_TYPES = ['hiring_funnel', 'applicant_source', 'time_to_hire'] as const;
export const REPORT_FREQUENCIES = ['weekly', 'monthly'] as const;

export const scheduledReports = pgTable(
  'scheduled_reports',
  {
    id: pk(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    reportType: varchar('report_type', { length: 30 }).notNull(),
    frequency: varchar('frequency', { length: 10 }).notNull(),
    sendAt: varchar('send_at', { length: 40 }),
    recipients: text('recipients').array().notNull().default(sql`'{}'`),
    isActive: boolean('is_active').notNull().default(true),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('scheduled_reports_employer_freq_idx').on(t.employerId, t.frequency),
    index('scheduled_reports_active_freq_idx').on(t.frequency, t.isActive),
  ],
);
