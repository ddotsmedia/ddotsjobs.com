import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { employers } from './employers.js';

export const INTEGRATION_PROVIDERS = ['slack', 'hubspot', 'linkedin', 'zapier', 'airtable'] as const;
export const INTEGRATION_EVENTS = ['job_posted', 'application_received', 'offer_sent'] as const;

// Employer connection to an external tool. Credentials are stored AES-256-GCM
// encrypted in access_token/refresh_token.
export const integrations = pgTable(
  'integrations',
  {
    id: pk(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    providerName: varchar('provider_name', { length: 20 }).notNull(),
    isConnected: boolean('is_connected').notNull().default(false),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    lastError: text('last_error'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('integrations_employer_provider_uq').on(t.employerId, t.providerName),
    index('integrations_connected_idx').on(t.employerId, t.isConnected),
  ],
);

// Per-integration event toggles.
export const integrationEvents = pgTable(
  'integration_events',
  {
    id: pk(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    isPushEnabled: boolean('is_push_enabled').notNull().default(true),
  },
  (t) => [
    uniqueIndex('integration_events_uq').on(t.integrationId, t.eventType),
    index('integration_events_integration_idx').on(t.integrationId),
  ],
);
