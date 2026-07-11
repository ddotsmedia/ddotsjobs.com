import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { employers } from './employers.js';
import { jobs } from './jobs.js';

export const DEFAULT_STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const;

// Per-job hiring pipeline stage list (0041). Absent row → DEFAULT_STAGES.
export const hiringPipelines = pgTable(
  'hiring_pipelines',
  {
    id: pk(),
    employerId: uuid('employer_id').notNull().references(() => employers.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    stages: jsonb('stages').$type<string[]>().notNull().default([...DEFAULT_STAGES]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [uniqueIndex('hiring_pipelines_job_uq').on(t.jobId), index('hiring_pipelines_employer_idx').on(t.employerId, t.jobId)],
);
