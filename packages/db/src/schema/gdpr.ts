import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';

// Async data-export jobs. One JSON bundle per request, stored 30 days.
export const dataExportRequests = pgTable(
  'data_export_requests',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // pending | processing | ready | failed | expired
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    storageKey: text('storage_key'),
    sizeBytes: integer('size_bytes'),
    error: text('error'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().default(sql`now()`),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    index('data_export_user_idx').on(t.userId, t.requestedAt),
    index('data_export_status_idx').on(t.status),
  ],
);

// Right-to-be-forgotten requests. Audit log is preserved (legal), user data soft/hard deleted.
export const dataDeletionRequests = pgTable(
  'data_deletion_requests',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // pending | approved | completed | denied
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    reason: text('reason'),
    // soft | hard
    mode: varchar('mode', { length: 10 }).notNull().default('soft'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewNote: text('review_note'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().default(sql`now()`),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('data_deletion_user_status_idx').on(t.userId, t.status),
    index('data_deletion_status_idx').on(t.status, t.requestedAt),
  ],
);
