import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pk, timestamps } from './_shared.js';
import { applicationStatus } from './enums.js';
import { employers } from './employers.js';
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
    employerId: uuid('employer_id').references(() => employers.id, { onDelete: 'cascade' }),
    status: applicationStatus('status').notNull().default('applied'),
    // applied | under_review | shortlisted | interview_scheduled | interviewed
    // | offer_made | rejected | withdrawn (superset of the enum).
    statusCode: varchar('status_code', { length: 30 }).notNull().default('applied'),
    coverNoteMl: text('cover_note_ml'),
    coverNoteEn: text('cover_note_en'),
    questionResponse: text('question_response'),
    hasVoiceNote: boolean('has_voice_note').notNull().default(false),
    voiceNoteR2Key: text('voice_note_r2_key'),
    voiceNoteDurationS: integer('voice_note_duration_s'),
    appliedVia: varchar('applied_via', { length: 20 }).notNull().default('web'),
    isQuickApply: boolean('is_quick_apply').notNull().default(false),
    // Snapshot of resume key at apply time (resume may change later).
    resumeR2Key: text('resume_r2_key'),
    // Cached fit score (0..100) at apply time for fast employer sorting.
    fitScore: smallint('fit_score'),
    fitScoreAtApply: integer('fit_score_at_apply'),
    fitBreakdownAtApply: jsonb('fit_breakdown_at_apply').$type<Record<string, number>>().notNull().default({}),
    statusHistory: jsonb('status_history')
      .$type<{ status: string; at: string }[]>()
      .notNull()
      .default([]),
    employerNote: text('employer_note'),
    // ATS pipeline (0041).
    stage: varchar('stage', { length: 30 }).notNull().default('applied'),
    stagedAt: timestamp('staged_at', { withTimezone: true }),
    notesByEmployer: jsonb('notes_by_employer').$type<{ note: string; at: string }[]>().notNull().default([]),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().default(sql`now()`),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
    statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true }),
    interviewScheduledAt: timestamp('interview_scheduled_at', { withTimezone: true }),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('applications_job_seeker_uq')
      .on(t.jobId, t.seekerUserId)
      .where(sql`deleted_at IS NULL`),
    index('applications_job_idx').on(t.jobId),
    index('applications_seeker_idx').on(t.seekerUserId),
    index('applications_status_idx').on(t.status),
    index('applications_employer_idx').on(t.employerId),
    index('applications_status_code_idx').on(t.statusCode),
  ],
);
