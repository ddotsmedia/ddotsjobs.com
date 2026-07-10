import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';
import { employers } from './employers.js';
import { jobs } from './jobs.js';

// Append-only analytics events powering the employer analytics dashboard.
// See migrations/0030_analytics_events.sql. Applications remain authoritative
// for real applies; this table adds per-event timestamps for timelines/funnels.
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: pk(),
    employerId: uuid('employer_id').references(() => employers.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    // job_view | profile_view | apply | apply_cta_click
    eventType: varchar('event_type', { length: 30 }).notNull(),
    viewerUserId: uuid('viewer_user_id').references(() => users.id, { onDelete: 'set null' }),
    viewerIp: text('viewer_ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('analytics_events_employer_idx').on(t.employerId, t.createdAt),
    index('analytics_events_type_idx').on(t.eventType),
    index('analytics_events_job_idx').on(t.jobId, t.createdAt),
    index('analytics_events_created_idx').on(t.createdAt),
  ],
);
