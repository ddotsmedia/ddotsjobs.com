import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { pk, timestamps } from './_shared.js';
import { applicationStatus } from './enums.js';
import { jobs } from './jobs.js';
import { users } from './users.js';

export const applications = pgTable(
  'applications',
  {
    id: pk(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    seekerUserId: uuid('seeker_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: applicationStatus('status').notNull().default('applied'),
    coverNoteMl: text('cover_note_ml'),
    coverNoteEn: text('cover_note_en'),
    // Snapshot of resume key at apply time (resume may change later).
    resumeR2Key: text('resume_r2_key'),
    // Cached fit score (0..100) at apply time for fast employer sorting.
    fitScore: smallint('fit_score'),
    statusHistory: jsonb('status_history')
      .$type<{ status: string; at: string }[]>()
      .notNull()
      .default([]),
    employerNote: text('employer_note'),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().default(sql`now()`),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('applications_job_seeker_uq')
      .on(t.jobId, t.seekerUserId)
      .where(sql`deleted_at IS NULL`),
    index('applications_job_idx').on(t.jobId),
    index('applications_seeker_idx').on(t.seekerUserId),
    index('applications_status_idx').on(t.status),
  ],
);
