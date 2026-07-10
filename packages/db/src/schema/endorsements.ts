import { sql } from 'drizzle-orm';
import { index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';

// Peer skill endorsements — one per (endorser, endorsee, skill), toggleable.
// See migrations/0031_skill_endorsements.sql.
export const skillEndorsements = pgTable(
  'skill_endorsements',
  {
    id: pk(),
    endorserId: uuid('endorser_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    endorseeId: uuid('endorsee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    skillName: varchar('skill_name', { length: 80 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('skill_endorsements_uq').on(t.endorserId, t.endorseeId, t.skillName),
    index('skill_endorsements_endorsee_idx').on(t.endorseeId, t.skillName),
  ],
);

// Denormalized per-(user, skill) endorsement count for fast reads + leaderboard.
export const userSkillSummary = pgTable(
  'user_skill_summary',
  {
    id: pk(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    skillName: varchar('skill_name', { length: 80 }).notNull(),
    endorsementCount: integer('endorsement_count').notNull().default(0),
    lastEndorsedAt: timestamp('last_endorsed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('user_skill_summary_uq').on(t.userId, t.skillName),
    index('user_skill_summary_count_idx').on(t.userId, t.endorsementCount),
    index('user_skill_summary_skill_idx').on(t.skillName, t.endorsementCount),
  ],
);
