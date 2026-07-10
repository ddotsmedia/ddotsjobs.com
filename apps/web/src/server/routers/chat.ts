import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, count, createNotification, desc, eq, inArray, isNull, ne, or, sql, tables, type Database } from '@ddotsjobs/db';
import { protectedProcedure, router } from '../trpc.js';
import { rateLimit } from '../rate-limit.js';

// Canonical participant ordering so a pair maps to exactly one conversation.
function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// True if either user has blocked the other.
async function isBlocked(db: Database, x: string, y: string): Promise<boolean> {
  const b = tables.chatBlocks;
  const [row] = await db
    .select({ id: b.id })
    .from(b)
    .where(or(and(eq(b.blockerId, x), eq(b.blockedId, y)), and(eq(b.blockerId, y), eq(b.blockedId, x))))
    .limit(1);
  return Boolean(row);
}

// Load a conversation the caller belongs to; returns the row + the peer's id.
async function loadMembership(db: Database, conversationId: string, me: string) {
  const c = tables.conversations;
  const [convo] = await db.select().from(c).where(eq(c.id, conversationId)).limit(1);
  if (!convo || (convo.participantA !== me && convo.participantB !== me)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
  }
  const peerId = convo.participantA === me ? convo.participantB : convo.participantA;
  return { convo, peerId };
}

// Find-or-create the conversation between two users. Assumes checks done.
async function ensureConversation(db: Database, me: string, other: string): Promise<string> {
  const [a, b] = orderPair(me, other);
  const c = tables.conversations;
  const inserted = await db
    .insert(c)
    .values({ participantA: a, participantB: b })
    .onConflictDoNothing({ target: [c.participantA, c.participantB] })
    .returning({ id: c.id });
  if (inserted[0]) return inserted[0].id;
  const [existing] = await db
    .select({ id: c.id })
    .from(c)
    .where(and(eq(c.participantA, a), eq(c.participantB, b)))
    .limit(1);
  if (!existing) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  return existing.id;
}

async function startWith(ctx: { db: Database; user: { id: string } }, otherUserId: string): Promise<string> {
  if (otherUserId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot message yourself' });
  const [other] = await ctx.db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(and(eq(tables.users.id, otherUserId), isNull(tables.users.deletedAt)))
    .limit(1);
  if (!other) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
  if (await isBlocked(ctx.db, ctx.user.id, otherUserId)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Messaging is blocked between you and this user' });
  }
  return ensureConversation(ctx.db, ctx.user.id, otherUserId);
}

export const chatRouter = router({
  // Start (or fetch) a conversation with another user.
  startConversation: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => ({ conversationId: await startWith(ctx, input.userId) })),

  // Start a conversation with a job's employer (resolves the owner user).
  startConversationWithEmployer: protectedProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [emp] = await ctx.db
        .select({ ownerUserId: tables.employers.ownerUserId })
        .from(tables.employers)
        .where(and(eq(tables.employers.id, input.employerId), isNull(tables.employers.deletedAt)))
        .limit(1);
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employer not found' });
      return { conversationId: await startWith(ctx, emp.ownerUserId) };
    }),

  // Inbox — the caller's conversations with peer info + unread counts.
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    const c = tables.conversations;
    const me = ctx.user.id;
    const rows = await ctx.db
      .select({
        id: c.id,
        participantA: c.participantA,
        participantB: c.participantB,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unread: sql<number>`(select count(*)::int from messages m where m.conversation_id = ${c.id} and m.sender_id <> ${me} and m.read_at is null and m.deleted_at is null)`,
      })
      .from(c)
      .where(or(eq(c.participantA, me), eq(c.participantB, me)))
      .orderBy(desc(c.lastMessageAt))
      .limit(100);

    const peerIds = rows.map((r) => (r.participantA === me ? r.participantB : r.participantA));
    const peers = peerIds.length
      ? await ctx.db
          .select({ id: tables.users.id, name: tables.users.nameEn, role: tables.users.role })
          .from(tables.users)
          .where(inArray(tables.users.id, peerIds))
      : [];
    const peerMap = new Map(peers.map((p) => [p.id, p]));

    return rows.map((r) => {
      const peerId = r.participantA === me ? r.participantB : r.participantA;
      const peer = peerMap.get(peerId);
      return {
        id: r.id,
        peerId,
        peerName: peer?.name ?? 'User',
        peerRole: peer?.role ?? 'seeker',
        lastMessage: r.lastMessage,
        lastMessageAt: r.lastMessageAt,
        unread: r.unread,
      };
    });
  }),

  // Thread — messages + peer info + block state. Participant-guarded.
  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { peerId } = await loadMembership(ctx.db, input.conversationId, ctx.user.id);
      const m = tables.messages;
      const msgs = await ctx.db
        .select({ id: m.id, senderId: m.senderId, content: m.content, readAt: m.readAt, createdAt: m.createdAt, deletedAt: m.deletedAt })
        .from(m)
        .where(eq(m.conversationId, input.conversationId))
        .orderBy(m.createdAt)
        .limit(300);
      const [peer] = await ctx.db
        .select({ id: tables.users.id, name: tables.users.nameEn, role: tables.users.role })
        .from(tables.users)
        .where(eq(tables.users.id, peerId))
        .limit(1);
      const b = tables.chatBlocks;
      const [blk] = await ctx.db
        .select({ id: b.id })
        .from(b)
        .where(and(eq(b.blockerId, ctx.user.id), eq(b.blockedId, peerId)))
        .limit(1);
      return {
        messages: msgs.map((x) => ({
          id: x.id,
          mine: x.senderId === ctx.user.id,
          content: x.deletedAt ? '' : x.content,
          deleted: Boolean(x.deletedAt),
          readAt: x.readAt,
          createdAt: x.createdAt,
        })),
        peer: { id: peerId, name: peer?.name ?? 'User', role: peer?.role ?? 'seeker' },
        blockedByMe: Boolean(blk),
      };
    }),

  sendMessage: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid(), content: z.string().trim().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { peerId } = await loadMembership(ctx.db, input.conversationId, ctx.user.id);
      if (await isBlocked(ctx.db, ctx.user.id, peerId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Messaging is blocked' });
      }
      await rateLimit(ctx.redis, `chat:${ctx.user.id}`, 50, 86_400);

      const m = tables.messages;
      const [msg] = await ctx.db
        .insert(m)
        .values({ conversationId: input.conversationId, senderId: ctx.user.id, content: input.content })
        .returning({ id: m.id, content: m.content, createdAt: m.createdAt });
      const preview = input.content.slice(0, 120);
      await ctx.db
        .update(tables.conversations)
        .set({ lastMessage: preview, lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(tables.conversations.id, input.conversationId));

      // Notify the recipient (best-effort).
      const [me] = await ctx.db.select({ name: tables.users.nameEn }).from(tables.users).where(eq(tables.users.id, ctx.user.id)).limit(1);
      await createNotification({
        userId: peerId,
        type: 'chat.message',
        title: `New message from ${me?.name ?? 'someone'}`,
        body: preview,
        actionUrl: `/chat/${input.conversationId}`,
      }).catch(() => {
        /* best-effort */
      });

      return { id: msg!.id, mine: true as const, content: msg!.content, deleted: false as const, readAt: null, createdAt: msg!.createdAt };
    }),

  markAsRead: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadMembership(ctx.db, input.conversationId, ctx.user.id);
      const m = tables.messages;
      await ctx.db
        .update(m)
        .set({ readAt: new Date() })
        .where(and(eq(m.conversationId, input.conversationId), ne(m.senderId, ctx.user.id), isNull(m.readAt)));
      return { ok: true as const };
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const m = tables.messages;
      const [msg] = await ctx.db.select({ id: m.id, senderId: m.senderId }).from(m).where(eq(m.id, input.messageId)).limit(1);
      if (!msg || msg.senderId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your message' });
      await ctx.db.update(m).set({ deletedAt: new Date() }).where(eq(m.id, input.messageId));
      return { ok: true as const };
    }),

  blockUser: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST' });
      const b = tables.chatBlocks;
      await ctx.db
        .insert(b)
        .values({ blockerId: ctx.user.id, blockedId: input.userId })
        .onConflictDoNothing({ target: [b.blockerId, b.blockedId] });
      return { blocked: true as const };
    }),

  unblockUser: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const b = tables.chatBlocks;
      await ctx.db.delete(b).where(and(eq(b.blockerId, ctx.user.id), eq(b.blockedId, input.userId)));
      return { blocked: false as const };
    }),

  // Total unread messages across the caller's conversations — for the nav badge.
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const m = tables.messages;
    const c = tables.conversations;
    const me = ctx.user.id;
    const [row] = await ctx.db
      .select({ n: count() })
      .from(m)
      .innerJoin(c, eq(c.id, m.conversationId))
      .where(
        and(
          or(eq(c.participantA, me), eq(c.participantB, me)),
          ne(m.senderId, me),
          isNull(m.readAt),
          isNull(m.deletedAt),
        ),
      );
    return { count: row?.n ?? 0 };
  }),
});
