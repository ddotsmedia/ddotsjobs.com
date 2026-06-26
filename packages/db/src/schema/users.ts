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
import {
  contentLanguage,
  district,
  professionalRegistrationType,
  userRole,
  verificationStatus,
} from './enums.js';

export const users = pgTable(
  'users',
  {
    id: pk(),
    role: userRole('role').notNull().default('seeker'),
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 255 }),
    passwordHash: text('password_hash'),
    nameMl: varchar('name_ml', { length: 200 }),
    nameEn: varchar('name_en', { length: 200 }),
    primaryDistrict: district('primary_district'),
    primaryProfession: varchar('primary_profession', { length: 80 }),
    isVerifiedProfessional: boolean('is_verified_professional').notNull().default(false),
    preferredLanguage: contentLanguage('preferred_language').notNull().default('ml'),
    phoneVerified: boolean('phone_verified').notNull().default(false),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    emailVerified: boolean('email_verified').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    // Admin moderation (F1).
    isBanned: boolean('is_banned').notNull().default(false),
    banReason: text('ban_reason'),
    bannedAt: timestamp('banned_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_phone_uq').on(t.phone).where(sql`deleted_at IS NULL`),
    uniqueIndex('users_email_uq')
      .on(t.email)
      .where(sql`deleted_at IS NULL AND email IS NOT NULL`),
    index('users_role_idx').on(t.role),
  ],
);

export const seekerProfiles = pgTable(
  'seeker_profiles',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    headlineMl: varchar('headline_ml', { length: 255 }),
    headlineEn: varchar('headline_en', { length: 255 }),
    summaryMl: text('summary_ml'),
    summaryEn: text('summary_en'),
    homeDistrict: district('home_district'),
    currentDistrict: district('current_district'),
    willingToRelocate: boolean('willing_to_relocate').notNull().default(false),
    openToGulf: boolean('open_to_gulf').notNull().default(false),
    yearsExperience: varchar('years_experience', { length: 10 }),
    totalExperienceMonths: integer('total_experience_months'),
    currentEmployer: varchar('current_employer', { length: 255 }),
    // paise (integer). BIGINT — never decimal for currency.
    expectedSalaryMinPaise: bigint('expected_salary_min_paise', { mode: 'number' }),
    expectedSalaryMaxPaise: bigint('expected_salary_max_paise', { mode: 'number' }),
    skills: jsonb('skills').$type<string[]>().notNull().default([]),
    preferredCategories: jsonb('preferred_categories').$type<string[]>().notNull().default([]),
    preferredJobTypes: jsonb('preferred_job_types').$type<string[]>().notNull().default([]),
    // 'private' | 'selective' | 'open'
    visibility: varchar('visibility', { length: 20 }).notNull().default('selective'),
    contactViaPlatformOnly: boolean('contact_via_platform_only').notNull().default(true),
    showCurrentEmployer: boolean('show_current_employer').notNull().default(false),
    isOpenToWork: boolean('is_open_to_work').notNull().default(true),
    completionPct: integer('completion_pct').notNull().default(0),
    // Availability signal for the talent pool: immediate | one_month | flexible.
    urgencyLevel: varchar('urgency_level', { length: 20 }),
    resumeR2Key: text('resume_r2_key'),
    profileComplete: boolean('profile_complete').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('seeker_profiles_user_uq').on(t.userId),
    index('seeker_profiles_home_district_idx').on(t.homeDistrict),
  ],
);

export const professionalRegistrations = pgTable(
  'professional_registrations',
  {
    id: pk(),
    seekerProfileId: uuid('seeker_profile_id').references(() => seekerProfiles.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    type: professionalRegistrationType('type').notNull(),
    // Spec credential code (KNMC / KTET / KMC / ...). Source of truth for the UI.
    typeCode: varchar('type_code', { length: 40 }),
    registrationNumber: varchar('registration_number', { length: 100 }).notNull(),
    issuingBody: varchar('issuing_body', { length: 200 }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    status: verificationStatus('status').notNull().default('unverified'),
    // pending | verified | failed | manual_review (superset of the enum).
    statusCode: varchar('status_code', { length: 20 }).notNull().default('pending'),
    verificationMethod: varchar('verification_method', { length: 30 }),
    aiExtractedData: jsonb('ai_extracted_data').$type<Record<string, unknown>>().notNull().default({}),
    aiConfidenceScore: real('ai_confidence_score'),
    aiExtractionModel: varchar('ai_extraction_model', { length: 60 }),
    verifierNotes: text('verifier_notes'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    documentR2Key: text('document_r2_key'),
    ...timestamps,
  },
  (t) => [
    index('prof_reg_seeker_idx').on(t.seekerProfileId),
    index('prof_reg_user_idx').on(t.userId),
    index('prof_reg_type_idx').on(t.type),
    uniqueIndex('prof_reg_user_type_uq').on(t.userId, t.typeCode).where(sql`deleted_at IS NULL`),
  ],
);
