import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { district } from './enums.js';
import { employers } from './employers.js';

export const itParks = pgTable('it_parks', {
  id: pk(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  city: varchar('city', { length: 50 }).notNull(),
  district: district('district').notNull(),
  description: text('description'),
  totalCompanies: integer('total_companies').default(0),
  totalEmployees: integer('total_employees').default(0),
  establishedYear: smallint('established_year'),
  websiteUrl: text('website_url'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  activeJobsCount: integer('active_jobs_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const itParkTenants = pgTable(
  'it_park_tenants',
  {
    id: pk(),
    companyId: uuid('company_id').references(() => employers.id, { onDelete: 'cascade' }),
    parkId: uuid('park_id')
      .notNull()
      .references(() => itParks.id),
    campus: varchar('campus', { length: 50 }),
    isSez: boolean('is_sez').default(false),
    techStack: text('tech_stack').array().default(sql`'{}'`),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('it_park_tenants_company_park_uq').on(t.companyId, t.parkId),
    index('idx_it_park_tenants_park').on(t.parkId),
  ],
);
