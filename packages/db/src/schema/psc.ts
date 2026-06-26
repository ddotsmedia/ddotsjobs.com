import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pk, timestamps, tsvector } from './_shared.js';
import { alertChannel, district } from './enums.js';
import { users } from './users.js';

// Kerala PSC notifications (scraped + normalized).
export const pscNotifications = pgTable(
  'psc_notifications',
  {
    id: pk(),
    // PSC category number (official), unique per notification cycle.
    categoryNumber: varchar('category_number', { length: 40 }).notNull(),
    titleMl: text('title_ml'),
    titleEn: text('title_en').notNull(),
    departmentMl: varchar('department_ml', { length: 255 }),
    departmentEn: varchar('department_en', { length: 255 }),
    descriptionMl: text('description_ml'),
    descriptionEn: text('description_en'),
    scaleOfPay: varchar('scale_of_pay', { length: 120 }),
    qualificationEn: text('qualification_en'),
    district: district('district'),
    vacancies: integer('vacancies'),
    lastDateToApply: timestamp('last_date_to_apply', { withTimezone: true }),
    examDate: timestamp('exam_date', { withTimezone: true }),
    // active | exam_scheduled | rank_list | closed
    status: varchar('status', { length: 30 }).notNull().default('active'),
    sourceUrl: text('source_url'),
    gazetteDate: timestamp('gazette_date', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    // FTS vector — maintained by DB trigger.
    tsv: tsvector('tsv'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('psc_notifications_category_uq')
      .on(t.categoryNumber)
      .where(sql`deleted_at IS NULL`),
    index('psc_notifications_active_idx').on(t.isActive),
    index('psc_notifications_status_idx').on(t.status),
    index('psc_notifications_exam_date_idx').on(t.examDate),
    index('psc_notifications_last_date_idx').on(t.lastDateToApply),
  ],
);

export const pscSubscriptions = pgTable(
  'psc_subscriptions',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: alertChannel('channel').notNull().default('whatsapp'),
    // 'category' (per category_no). Future: 'department', 'qualification'.
    subscriptionType: varchar('subscription_type', { length: 30 }).notNull().default('category'),
    subscriptionValue: varchar('subscription_value', { length: 60 }),
    alertFor: jsonb('alert_for')
      .$type<string[]>()
      .notNull()
      .default(['new_notification', 'exam_date', 'rank_list', 'advice']),
    // Filter sets — qualification levels, departments, districts of interest.
    filters: jsonb('filters').$type<Record<string, unknown>>().notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('psc_subscriptions_user_value_uq')
      .on(t.userId, t.subscriptionValue)
      .where(sql`deleted_at IS NULL`),
    index('psc_subscriptions_active_idx').on(t.isActive),
  ],
);

// Tracks a candidate's rank-list position across PSC publications.
export const pscRankTracker = pgTable(
  'psc_rank_tracker',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    notificationId: uuid('notification_id').references(() => pscNotifications.id, {
      onDelete: 'set null',
    }),
    rankListName: varchar('rank_list_name', { length: 255 }).notNull(),
    rollNumber: varchar('roll_number', { length: 60 }),
    rank: integer('rank'),
    district: district('district'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    advicesMade: integer('advices_made').notNull().default(0),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('psc_rank_tracker_user_idx').on(t.userId),
    index('psc_rank_tracker_notification_idx').on(t.notificationId),
  ],
);

// NORKA-Roots welfare / overseas-employment schemes catalogue.
export const norkaSchemes = pgTable(
  'norka_schemes',
  {
    id: pk(),
    slug: varchar('slug', { length: 120 }).notNull(),
    titleMl: text('title_ml'),
    titleEn: text('title_en').notNull(),
    summaryMl: text('summary_ml'),
    summaryEn: text('summary_en'),
    eligibilityMl: text('eligibility_ml'),
    eligibilityEn: text('eligibility_en'),
    benefitsMl: text('benefits_ml'),
    benefitsEn: text('benefits_en'),
    applyUrl: text('apply_url'),
    category: varchar('category', { length: 80 }),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('norka_schemes_slug_uq').on(t.slug).where(sql`deleted_at IS NULL`),
    index('norka_schemes_active_idx').on(t.isActive),
  ],
);
