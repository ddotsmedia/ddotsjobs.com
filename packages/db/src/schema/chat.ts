import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';
import { users } from './users.js';

// 1:1 conversations. Participants stored as a canonically-ordered pair
// (participant_a < participant_b) → one row per pair. See migration 0032.
export const conversations = pgTable(
  'conversations',
  {
    id: pk(),
    participantA: uuid('participant_a').notNull().references(() => users.id, { onDelete: 'cascade' }),
    participantB: uuid('participant_b').notNull().references(() => users.id, { onDelete: 'cascade' }),
    lastMessage: text('last_message'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('conversations_pair_uq').on(t.participantA, t.participantB),
    index('conversations_a_idx').on(t.participantA, t.lastMessageAt),
    index('conversations_b_idx').on(t.participantB, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: pk(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)],
);

// Directional blocks — blocker no longer exchanges messages with blocked.
export const chatBlocks = pgTable(
  'chat_blocks',
  {
    id: pk(),
    blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [uniqueIndex('chat_blocks_uq').on(t.blockerId, t.blockedId)],
);
