import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';
import { jobs } from './jobs.js';
import { applications } from './applications.js';

export interface MatchReasons {
  skills: string[];
  experience: string;
  education: string;
  gaps: string[];
}

// AI resume-screening result — one per application (rescore updates). See
// migration 0035. Ranks applicants by ai_score; match_reasons + reasoning are
// shown to the employer.
export const applicantScores = pgTable(
  'applicant_scores',
  {
    id: pk(),
    applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    aiScore: integer('ai_score').notNull(),
    matchReasons: jsonb('match_reasons').$type<MatchReasons>().notNull().default(sql`'{}'::jsonb`),
    reasoning: text('reasoning'),
    model: varchar('model', { length: 20 }),
    scoredAt: timestamp('scored_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('applicant_scores_application_uq').on(t.applicationId),
    index('applicant_scores_job_idx').on(t.jobId, t.aiScore),
    index('applicant_scores_user_idx').on(t.userId),
  ],
);
