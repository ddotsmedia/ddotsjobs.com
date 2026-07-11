import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';
import { jobs } from './jobs.js';

export interface InterviewAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  engagement: number; // 0-100
  topics: string[];
  strengths: string[];
  gaps: string[];
  score: number; // 0-100
  summary: string;
}

// Async video interview — one per (employer, candidate, job). See migration 0036.
export const videoInterviews = pgTable(
  'video_interviews',
  {
    id: pk(),
    jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    interviewerId: uuid('interviewer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 15 }).notNull().default('scheduled'),
    aiAnalysis: jsonb('ai_analysis').$type<InterviewAnalysis>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [
    index('video_interviews_job_idx').on(t.jobId, t.status),
    index('video_interviews_candidate_idx').on(t.candidateId, t.status),
    index('video_interviews_interviewer_idx').on(t.interviewerId, t.status),
  ],
);

export const interviewQuestions = pgTable(
  'interview_questions',
  {
    id: pk(),
    interviewId: uuid('interview_id').notNull().references(() => videoInterviews.id, { onDelete: 'cascade' }),
    questionText: text('question_text').notNull(),
    timeLimit: integer('time_limit').notNull().default(120),
    order: integer('order').notNull().default(0),
  },
  (t) => [index('interview_questions_interview_idx').on(t.interviewId, t.order)],
);

export const interviewVideos = pgTable(
  'interview_videos',
  {
    id: pk(),
    interviewId: uuid('interview_id').notNull().references(() => videoInterviews.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id').notNull().references(() => interviewQuestions.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    duration: integer('duration'),
    transcript: text('transcript'),
    transcriptUrl: text('transcript_url'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [uniqueIndex('interview_videos_q_uq').on(t.interviewId, t.questionId)],
);
