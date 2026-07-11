import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';

export interface TenantColors {
  primary?: string;
  secondary?: string;
  accent?: string;
}

// White-label tenant — per-domain branding + feature flags (0038). Full data
// isolation (tenant_id on all tables) is deliberately out of scope here.
export const tenants = pgTable(
  'tenants',
  {
    id: pk(),
    slug: varchar('slug', { length: 50 }).notNull(),
    domain: varchar('domain', { length: 255 }),
    name: varchar('name', { length: 120 }).notNull(),
    logo: text('logo'),
    colors: jsonb('colors').$type<TenantColors>().notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('tenants_slug_uq').on(t.slug),
    uniqueIndex('tenants_domain_uq').on(t.domain),
    index('tenants_active_idx').on(t.isActive),
  ],
);

export const tenantFeatures = pgTable(
  'tenant_features',
  {
    id: pk(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    feature: varchar('feature', { length: 50 }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
  },
  (t) => [uniqueIndex('tenant_features_uq').on(t.tenantId, t.feature)],
);
