import { sql } from 'drizzle-orm';
import {
  bigint,
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
import { district, employerType, itPark, verificationStatus } from './enums.js';
import { users } from './users.js';
import { jobs } from './jobs.js';

export const employers = pgTable(
  'employers',
  {
    id: pk(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: employerType('type').notNull().default('direct'),
    legalNameEn: varchar('legal_name_en', { length: 255 }).notNull(),
    displayNameMl: varchar('display_name_ml', { length: 255 }),
    displayNameEn: varchar('display_name_en', { length: 255 }),
    descriptionMl: text('description_ml'),
    descriptionEn: text('description_en'),
    websiteUrl: text('website_url'),
    logoR2Key: text('logo_r2_key'),
    district: district('district'),
    itPark: itPark('it_park'),
    gstin: varchar('gstin', { length: 20 }),
    // Recruitment licence (e.g. eMigrate / PB&OE) for gulf agencies.
    recruitmentLicenceNo: varchar('recruitment_licence_no', { length: 100 }),
    verificationStatus: verificationStatus('verification_status').notNull().default('unverified'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    isBlacklisted: boolean('is_blacklisted').notNull().default(false),
    contactPhone: varchar('contact_phone', { length: 20 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    ...timestamps,
  },
  (t) => [
    index('employers_owner_idx').on(t.ownerUserId),
    index('employers_type_idx').on(t.type),
    index('employers_district_idx').on(t.district),
    uniqueIndex('employers_gstin_uq')
      .on(t.gstin)
      .where(sql`gstin IS NOT NULL AND deleted_at IS NULL`),
  ],
);

export const companyReviews = pgTable(
  'company_reviews',
  {
    id: pk(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // 1..5
    rating: smallint('rating').notNull(),
    titleMl: varchar('title_ml', { length: 255 }),
    titleEn: varchar('title_en', { length: 255 }),
    bodyMl: text('body_ml'),
    bodyEn: text('body_en'),
    isAnonymous: boolean('is_anonymous').notNull().default(true),
    isVerifiedEmployee: boolean('is_verified_employee').notNull().default(false),
    helpfulCount: integer('helpful_count').notNull().default(0),
    status: verificationStatus('status').notNull().default('pending'),
    ...timestamps,
  },
  (t) => [
    index('company_reviews_employer_idx').on(t.employerId),
    uniqueIndex('company_reviews_author_employer_uq')
      .on(t.authorUserId, t.employerId)
      .where(sql`deleted_at IS NULL`),
  ],
);

// Tracks employer → seeker contact events (gulf agency contact quota, etc).
export const employerSeekerContacts = pgTable(
  'employer_seeker_contacts',
  {
    id: pk(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    seekerUserId: uuid('seeker_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    channel: varchar('channel', { length: 30 }).notNull(),
    note: text('note'),
    // paise charged for this contact unlock, if any.
    costPaise: bigint('cost_paise', { mode: 'number' }).notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('emp_seeker_contacts_employer_idx').on(t.employerId),
    index('emp_seeker_contacts_seeker_idx').on(t.seekerUserId),
    uniqueIndex('emp_seeker_contacts_uq')
      .on(t.employerId, t.seekerUserId, t.jobId)
      .where(sql`deleted_at IS NULL`),
  ],
);
