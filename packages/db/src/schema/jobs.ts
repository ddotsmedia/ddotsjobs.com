import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pk, timestamps, tsvector, vector } from './_shared.js';
import {
  district,
  gulfCountry,
  itPark,
  jobStatus,
  jobType,
  visibilityLevel,
} from './enums.js';
import { employers } from './employers.js';
import { itParks } from './it_parks.js';
import { users } from './users.js';

export const jobs = pgTable(
  'jobs',
  {
    id: pk(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    // URL slug — set on publish (D2); unique among live jobs.
    slug: varchar('slug', { length: 255 }),
    titleMl: varchar('title_ml', { length: 255 }),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    descriptionMl: text('description_ml'),
    descriptionEn: text('description_en').notNull(),
    type: jobType('type').notNull().default('full_time'),
    status: jobStatus('status').notNull().default('draft'),
    visibility: visibilityLevel('visibility').notNull().default('public'),
    district: district('district'),
    itPark: itPark('it_park'),
    // FK to the it_parks hub table (distinct from the it_park enum above).
    itParkId: uuid('it_park_id').references(() => itParks.id),
    gulfCountry: gulfCountry('gulf_country'),
    locationText: varchar('location_text', { length: 255 }),
    isRemote: boolean('is_remote').notNull().default(false),
    // paise (integer). BIGINT.
    salaryMinPaise: bigint('salary_min_paise', { mode: 'number' }),
    salaryMaxPaise: bigint('salary_max_paise', { mode: 'number' }),
    salaryPeriod: varchar('salary_period', { length: 20 }).notNull().default('monthly'),
    vacancies: integer('vacancies').notNull().default(1),
    minExperienceYears: smallint('min_experience_years').notNull().default(0),
    minExperienceMonths: integer('min_experience_months').notNull().default(0),
    // 'both' | 'ml' | 'en' — language expected for the role.
    languageRequirement: varchar('language_requirement', { length: 10 }).notNull().default('both'),
    skills: jsonb('skills').$type<string[]>().notNull().default([]),
    requirementsEn: text('requirements_en'),
    requirementsMl: text('requirements_ml'),
    benefitsEn: text('benefits_en'),
    benefitsMl: text('benefits_ml'),
    employerQuestionEn: text('employer_question_en'),
    employerQuestionMl: text('employer_question_ml'),
    requiredCertifications: jsonb('required_certifications').$type<string[]>().notNull().default([]),
    validThrough: timestamp('valid_through', { withTimezone: true }),
    categorySlug: varchar('category_slug', { length: 100 }),
    applicationDeadline: timestamp('application_deadline', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    googleIndexedAt: timestamp('google_indexed_at', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    applicationCount: integer('application_count').notNull().default(0),
    alertRecipientsCount: integer('alert_recipients_count').notNull().default(0),
    isWalkIn: boolean('is_walk_in').notNull().default(false),
    // True if the employer wants candidates with gulf work experience.
    valuesGulfExperience: boolean('values_gulf_experience').notNull().default(false),
    // False => salary hidden ("Market rate") even when min/max set.
    salaryDisclosed: boolean('salary_disclosed').notNull().default(true),
    // Full-text search vector — maintained by DB trigger, never written by app.
    tsv: tsvector('tsv'),
    // Semantic embedding (Anthropic/Voyage 1536-dim) — backfilled by worker.
    embedding: vector('embedding', { dimensions: 1536 }),
    ...timestamps,
  },
  (t) => [
    index('jobs_employer_idx').on(t.employerId),
    index('jobs_status_idx').on(t.status),
    index('jobs_type_idx').on(t.type),
    index('jobs_district_idx').on(t.district),
    index('jobs_category_idx').on(t.categorySlug),
    index('jobs_published_at_idx').on(t.publishedAt),
    index('jobs_values_gulf_idx').on(t.valuesGulfExperience),
    uniqueIndex('jobs_slug_uq')
      .on(t.slug)
      .where(sql`slug IS NOT NULL AND deleted_at IS NULL`),
  ],
);

export const walkInEvents = pgTable(
  'walk_in_events',
  {
    id: pk(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    venueMl: varchar('venue_ml', { length: 255 }),
    venueEn: varchar('venue_en', { length: 255 }).notNull(),
    district: district('district'),
    addressText: text('address_text'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    contactPhone: varchar('contact_phone', { length: 20 }),
    instructionsMl: text('instructions_ml'),
    instructionsEn: text('instructions_en'),
    noticeGeneratedAt: timestamp('notice_generated_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('walk_in_events_job_idx').on(t.jobId),
    index('walk_in_events_starts_at_idx').on(t.startsAt),
  ],
);

// AI fit score between a seeker and a job. Computed via Sonnet (reasoning tier).
export const fitScores = pgTable(
  'fit_scores',
  {
    id: pk(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    seekerUserId: uuid('seeker_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // 0..100 integer overall fit.
    score: smallint('score').notNull(),
    overallScore: integer('overall_score'),
    qualificationScore: integer('qualification_score'),
    experienceScore: integer('experience_score'),
    locationScore: integer('location_score'),
    salaryScore: integer('salary_score'),
    languageScore: integer('language_score'),
    certBonus: integer('cert_bonus').notNull().default(0),
    recommendation: varchar('recommendation', { length: 20 }),
    explanationEn: text('explanation_en'),
    explanationMl: text('explanation_ml'),
    breakdown: jsonb('breakdown').$type<Record<string, number>>().notNull().default({}),
    rationaleMl: text('rationale_ml'),
    rationaleEn: text('rationale_en'),
    modelId: varchar('model_id', { length: 60 }).notNull(),
    promptVersion: integer('prompt_version').notNull().default(1),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().default(sql`now()`),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('fit_scores_job_seeker_uq')
      .on(t.jobId, t.seekerUserId)
      .where(sql`deleted_at IS NULL`),
    index('fit_scores_seeker_idx').on(t.seekerUserId),
  ],
);

// Seeker-saved jobs (soft-delete toggle).
export const savedJobs = pgTable(
  'saved_jobs',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('saved_jobs_user_job_uq').on(t.userId, t.jobId),
    index('saved_jobs_user_idx').on(t.userId).where(sql`deleted_at IS NULL`),
  ],
);

// Aggregated, anonymized salary observations powering salary insights.
export const salaryDataPoints = pgTable(
  'salary_data_points',
  {
    id: pk(),
    categorySlug: varchar('category_slug', { length: 100 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }),
    district: district('district'),
    itPark: itPark('it_park'),
    yearsExperience: smallint('years_experience'),
    // paise (integer). BIGINT.
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    period: varchar('period', { length: 20 }).notNull().default('monthly'),
    source: varchar('source', { length: 60 }).notNull().default('self_reported'),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('salary_dp_category_idx').on(t.categorySlug),
    index('salary_dp_district_idx').on(t.district),
  ],
);
