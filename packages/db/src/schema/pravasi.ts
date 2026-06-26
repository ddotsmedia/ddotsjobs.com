import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pk, timestamps } from './_shared.js';
import { gulfCountry } from './enums.js';
import { users } from './users.js';

// Returnee / overseas-worker (pravasi) profile extension.
export const pravasiProfiles = pgTable(
  'pravasi_profiles',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    currentCountry: gulfCountry('current_country'),
    isReturnee: boolean('is_returnee').notNull().default(false),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    totalYearsAbroad: integer('total_years_abroad'),
    financialUrgency: varchar('financial_urgency', { length: 30 }).notNull().default('moderate'),
    seekingEmploymentIn: jsonb('seeking_employment_in').$type<string[]>().notNull().default([]),
    passportNumberMasked: varchar('passport_number_masked', { length: 30 }),
    emigrationClearance: boolean('emigration_clearance').notNull().default(false),
    norkaIdMasked: varchar('norka_id_masked', { length: 60 }),
    preferredCountries: jsonb('preferred_countries')
      .$type<string[]>()
      .notNull()
      .default([]),
    skillsGulf: jsonb('skills_gulf').$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('pravasi_profiles_user_uq').on(t.userId).where(sql`deleted_at IS NULL`),
    index('pravasi_profiles_country_idx').on(t.currentCountry),
  ],
);

export const pravasiWorkHistory = pgTable(
  'pravasi_work_history',
  {
    id: pk(),
    pravasiProfileId: uuid('pravasi_profile_id')
      .notNull()
      .references(() => pravasiProfiles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    employerName: varchar('employer_name', { length: 255 }),
    country: gulfCountry('country'),
    titleEn: varchar('title_en', { length: 255 }),
    titleLocal: varchar('title_local', { length: 255 }),
    gulfJobTitle: varchar('gulf_job_title', { length: 255 }),
    industry: varchar('industry', { length: 120 }),
    yearsInRole: integer('years_in_role'),
    keySkills: jsonb('key_skills').$type<string[]>().notNull().default([]),
    certifications: jsonb('certifications').$type<string[]>().notNull().default([]),
    translatedKeralaTitles: jsonb('translated_kerala_titles').$type<string[]>().notNull().default([]),
    translationConfidence: real('translation_confidence'),
    translationSource: varchar('translation_source', { length: 30 }),
    sortOrder: integer('sort_order').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    // Last drawn salary in paise (INR-equivalent), BIGINT.
    lastSalaryPaise: bigint('last_salary_paise', { mode: 'number' }),
    currencyCode: varchar('currency_code', { length: 3 }),
    descriptionEn: text('description_en'),
    ...timestamps,
  },
  (t) => [
    index('pravasi_work_history_profile_idx').on(t.pravasiProfileId),
    index('pravasi_work_history_user_idx').on(t.userId),
  ],
);

// Maps gulf/local job titles to canonical ddotsjobs categories + Malayalam.
export const gulfTitleTranslations = pgTable(
  'gulf_title_translations',
  {
    id: pk(),
    sourceTitle: varchar('source_title', { length: 255 }).notNull(),
    gulfTitle: varchar('gulf_title', { length: 255 }),
    gulfTitleNormalized: varchar('gulf_title_normalized', { length: 255 }),
    keralaEquivalents: jsonb('kerala_equivalents').$type<string[]>().notNull().default([]),
    industry: varchar('industry', { length: 120 }),
    confidenceScore: real('confidence_score'),
    translationSource: varchar('translation_source', { length: 30 }),
    country: gulfCountry('country'),
    canonicalTitleEn: varchar('canonical_title_en', { length: 255 }).notNull(),
    canonicalTitleMl: varchar('canonical_title_ml', { length: 255 }),
    categorySlug: varchar('category_slug', { length: 100 }),
    confidence: varchar('confidence', { length: 10 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('gulf_title_translations_uq')
      .on(t.sourceTitle, t.country)
      .where(sql`deleted_at IS NULL`),
    uniqueIndex('gulf_title_normalized_uq')
      .on(t.gulfTitleNormalized)
      .where(sql`gulf_title_normalized IS NOT NULL`),
    index('gulf_title_translations_category_idx').on(t.categorySlug),
  ],
);
