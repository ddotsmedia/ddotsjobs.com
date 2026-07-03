import { sql } from 'drizzle-orm';
import { boolean, char, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';

export const assessments = pgTable('assessments', {
  id: pk(),
  slug: varchar('slug', { length: 60 }).notNull().unique(),
  title: varchar('title', { length: 120 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 16 }),
  passingScore: integer('passing_score').notNull().default(70),
  totalQuestions: integer('total_questions').notNull().default(5),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const assessmentQuestions = pgTable(
  'assessment_questions',
  {
    id: pk(),
    assessmentId: uuid('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
    questionNumber: integer('question_number').notNull(),
    questionText: text('question_text').notNull(),
    correctAnswer: char('correct_answer', { length: 1 }).notNull(),
    optionA: text('option_a').notNull(),
    optionB: text('option_b').notNull(),
    optionC: text('option_c').notNull(),
    optionD: text('option_d').notNull(),
    explanation: text('explanation'),
  },
  (t) => [uniqueIndex('assessment_questions_aq_uq').on(t.assessmentId, t.questionNumber)],
);

export const assessmentAttempts = pgTable(
  'assessment_attempts',
  {
    id: pk(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    passed: boolean('passed').notNull().default(false),
    answersJson: jsonb('answers_json').$type<Record<string, string>>().notNull().default({}),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().default(sql`now()`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('attempts_user_idx').on(t.userId), index('attempts_assessment_idx').on(t.assessmentId)],
);

export const userBadges = pgTable(
  'user_badges',
  {
    id: pk(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [uniqueIndex('user_badges_uq').on(t.userId, t.assessmentId), index('user_badges_user_idx').on(t.userId)],
);
