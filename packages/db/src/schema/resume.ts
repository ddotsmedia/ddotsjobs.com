import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';

export interface ResumeExperience {
  company: string;
  role: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}
export interface ResumeEducation {
  institution: string;
  degree: string;
  year?: string;
}
export interface ResumeCertification {
  name: string;
  issuer?: string;
  year?: string;
}

// Seeker-built resume (multi-template, AI-assisted summary).
export const resumeProfiles = pgTable(
  'resume_profiles',
  {
    id: pk(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    summary: text('summary'),
    experience: jsonb('experience').$type<ResumeExperience[]>().notNull().default([]),
    education: jsonb('education').$type<ResumeEducation[]>().notNull().default([]),
    skills: text('skills').array().notNull().default(sql`'{}'`),
    languages: text('languages').array().notNull().default(sql`'{}'`),
    certifications: jsonb('certifications').$type<ResumeCertification[]>().notNull().default([]),
    templateId: varchar('template_id', { length: 40 }).notNull().default('kerala-classic'),
    isPublic: boolean('is_public').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('resume_profiles_user_idx').on(t.userId)],
);
