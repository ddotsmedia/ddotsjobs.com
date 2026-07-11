import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { employers } from './employers.js';

// API keys for the programmatic job-posting API (0040). key_hash = SHA-256 of
// the full key (deterministic lookup). Raw key is never stored.
export const apiKeys = pgTable(
  'api_keys',
  {
    id: pk(),
    employerId: uuid('employer_id').notNull().references(() => employers.id, { onDelete: 'cascade' }),
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 24 }).notNull(),
    label: varchar('label', { length: 100 }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('api_keys_hash_uq').on(t.keyHash), index('api_keys_employer_idx').on(t.employerId)],
);
