import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';

// Append-only audit trail. NOT soft-deletable — records are immutable.
export const auditLog = pgTable(
  'audit_log',
  {
    id: pk(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: uuid('entity_id'),
    diff: jsonb('diff').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorUserId),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_action_idx').on(t.action),
    index('audit_log_created_at_idx').on(t.createdAt),
  ],
);
