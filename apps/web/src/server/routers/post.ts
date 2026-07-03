import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { publicProcedure, protectedProcedure, router } from '../trpc.js';
import { rateLimit } from '../rate-limit.js';
import { stripHtml } from '@/lib/sanitize';
import { logAction } from '@/lib/audit';

const authorName = sql<string>`coalesce(${tables.users.nameEn}, 'Member')`;

export const postRouter = router({
  getPosts: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20), cursor: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const p = tables.posts;
      const uid = ctx.session?.user?.id ?? null;
      const conds = [isNull(p.deletedAt)];
      if (input.cursor) {
        conds.push(sql`(${p.createdAt}, ${p.id}) < ((select created_at from posts where id = ${input.cursor}), ${input.cursor}::uuid)`);
      }
      const rows = await ctx.db
        .select({
          id: p.id,
          content: p.content,
          createdAt: p.createdAt,
          userId: p.userId,
          authorName,
          likeCount: sql<number>`(select count(*)::int from ${tables.postLikes} pl where pl.post_id = ${p.id})`,
          commentCount: sql<number>`(select count(*)::int from ${tables.postComments} pc where pc.post_id = ${p.id} and pc.deleted_at is null)`,
          likedByMe: uid
            ? sql<boolean>`exists (select 1 from ${tables.postLikes} pl where pl.post_id = ${p.id} and pl.user_id = ${uid})`
            : sql<boolean>`false`,
        })
        .from(p)
        .innerJoin(tables.users, eq(tables.users.id, p.userId))
        .where(and(...conds))
        .orderBy(desc(p.createdAt))
        .limit(input.limit + 1);

      let nextCursor: string | undefined;
      if (rows.length > input.limit) nextCursor = rows.pop()!.id;
      return { posts: rows, nextCursor, viewerId: uid };
    }),

  createPost: protectedProcedure
    .input(z.object({ content: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.redis, `post:${ctx.user.id}`, 20, 3600);
      const [row] = await ctx.db
        .insert(tables.posts)
        .values({ userId: ctx.user.id, content: stripHtml(input.content).trim() })
        .returning({ id: tables.posts.id, content: tables.posts.content, createdAt: tables.posts.createdAt });
      if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await logAction(ctx, 'post.created', 'post', row.id);
      return { ...row, userId: ctx.user.id, likeCount: 0, commentCount: 0, likedByMe: false };
    }),

  likePost: protectedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const pl = tables.postLikes;
      const [existing] = await ctx.db
        .select({ id: pl.id })
        .from(pl)
        .where(and(eq(pl.userId, ctx.user.id), eq(pl.postId, input.postId)))
        .limit(1);
      if (existing) {
        await ctx.db.delete(pl).where(eq(pl.id, existing.id));
      } else {
        await ctx.db.insert(pl).values({ userId: ctx.user.id, postId: input.postId });
      }
      const [c] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(pl).where(eq(pl.postId, input.postId));
      return { liked: !existing, likeCount: c?.n ?? 0 };
    }),

  deletePost: protectedProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.role as string;
      const isAdmin = role === 'admin' || role === 'super_admin';
      const res = await ctx.db
        .update(tables.posts)
        .set({ deletedAt: new Date() })
        .where(and(eq(tables.posts.id, input.postId), isAdmin ? undefined : eq(tables.posts.userId, ctx.user.id), isNull(tables.posts.deletedAt)))
        .returning({ id: tables.posts.id });
      if (res.length === 0) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed' });
      await logAction(ctx, 'post.deleted', 'post', input.postId);
      return { success: true as const };
    }),

  getPostComments: publicProcedure
    .input(z.object({ postId: z.string().uuid(), limit: z.number().int().min(1).max(50).default(10), cursor: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const c = tables.postComments;
      const conds = [eq(c.postId, input.postId), isNull(c.deletedAt)];
      if (input.cursor) {
        conds.push(sql`(${c.createdAt}, ${c.id}) < ((select created_at from post_comments where id = ${input.cursor}), ${input.cursor}::uuid)`);
      }
      const rows = await ctx.db
        .select({ id: c.id, content: c.content, createdAt: c.createdAt, userId: c.userId, authorName })
        .from(c)
        .innerJoin(tables.users, eq(tables.users.id, c.userId))
        .where(and(...conds))
        .orderBy(desc(c.createdAt))
        .limit(input.limit + 1);
      let nextCursor: string | undefined;
      if (rows.length > input.limit) nextCursor = rows.pop()!.id;
      return { comments: rows, nextCursor };
    }),

  addComment: protectedProcedure
    .input(z.object({ postId: z.string().uuid(), content: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.redis, `comment:${ctx.user.id}`, 40, 3600);
      const [row] = await ctx.db
        .insert(tables.postComments)
        .values({ userId: ctx.user.id, postId: input.postId, content: stripHtml(input.content).trim() })
        .returning({ id: tables.postComments.id, content: tables.postComments.content, createdAt: tables.postComments.createdAt });
      if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [u] = await ctx.db.select({ name: authorName }).from(tables.users).where(eq(tables.users.id, ctx.user.id)).limit(1);
      await logAction(ctx, 'comment.added', 'comment', row.id, { postId: input.postId });
      return { ...row, userId: ctx.user.id, authorName: u?.name ?? 'Member' };
    }),

  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.role as string;
      const isAdmin = role === 'admin' || role === 'super_admin';
      const res = await ctx.db
        .update(tables.postComments)
        .set({ deletedAt: new Date() })
        .where(and(eq(tables.postComments.id, input.commentId), isAdmin ? undefined : eq(tables.postComments.userId, ctx.user.id), isNull(tables.postComments.deletedAt)))
        .returning({ id: tables.postComments.id });
      if (res.length === 0) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed' });
      await logAction(ctx, 'comment.deleted', 'comment', input.commentId);
      return { success: true as const };
    }),
});
