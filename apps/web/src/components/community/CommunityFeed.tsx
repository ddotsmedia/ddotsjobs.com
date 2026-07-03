'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { relativeTime } from '@/lib/format';

export function CommunityFeed({ authed, viewerId }: { authed: boolean; viewerId: string | null }) {
  const [draft, setDraft] = useState('');
  const utils = trpc.useUtils();
  const feed = trpc.post.getPosts.useInfiniteQuery({ limit: 20 }, { getNextPageParam: (last) => last.nextCursor });
  const create = trpc.post.createPost.useMutation({
    onSuccess: () => { setDraft(''); void utils.post.getPosts.invalidate(); },
  });

  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <h1 style={s.h1}>Community</h1>
          <p style={s.sub}>തൊഴിൽ community — share job tips, questions and success stories.</p>
        </header>

        {authed ? (
          <div style={s.compose}>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} rows={3} placeholder="Share a tip, ask a question…" style={s.textarea} />
            <div style={s.composeBar}>
              <span style={s.count}>{draft.length}/1000</span>
              <button type="button" disabled={draft.trim().length === 0 || create.isPending} onClick={() => create.mutate({ content: draft.trim() })} style={s.postBtn}>{create.isPending ? 'Posting…' : 'Post'}</button>
            </div>
          </div>
        ) : (
          <div style={s.loginNudge}>
            <Link href="/login?next=/community" style={s.loginLink}>Sign in</Link> to post, like and comment.
          </div>
        )}

        {feed.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : posts.length === 0 ? (
          <p style={s.muted}>No posts yet. Be the first to share.</p>
        ) : (
          <div style={s.list}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} authed={authed} viewerId={viewerId} />
            ))}
          </div>
        )}

        {feed.hasNextPage && (
          <button type="button" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage} style={s.moreBtn}>
            {feed.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </main>
  );
}

type Post = { id: string; content: string; createdAt: string | Date; userId: string; authorName: string; likeCount: number; commentCount: number; likedByMe: boolean };

function PostCard({ post, authed, viewerId }: { post: Post; authed: boolean; viewerId: string | null }) {
  const utils = trpc.useUtils();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);
  const like = trpc.post.likePost.useMutation({ onSuccess: (r) => { setLiked(r.liked); setLikeCount(r.likeCount); } });
  const del = trpc.post.deletePost.useMutation({ onSuccess: () => void utils.post.getPosts.invalidate() });
  const isOwn = viewerId === post.userId;

  return (
    <article style={s.card}>
      <div style={s.cardHead}>
        <span style={s.avatar}>{(post.authorName[0] ?? 'M').toUpperCase()}</span>
        <div style={{ flex: 1 }}>
          <div style={s.author}>{post.authorName}</div>
          <div style={s.time}>{relativeTime(post.createdAt)}</div>
        </div>
        {isOwn && <button type="button" onClick={() => del.mutate({ postId: post.id })} style={s.del}>Delete</button>}
      </div>
      <p style={s.content}>{post.content}</p>
      <div style={s.actions}>
        <button type="button" disabled={!authed || like.isPending} onClick={() => like.mutate({ postId: post.id })} style={{ ...s.actBtn, color: liked ? '#E8623A' : '#6b6860' }}>
          {liked ? '❤️' : '🤍'} {likeCount}
        </button>
        <button type="button" onClick={() => setShowComments((v) => !v)} style={s.actBtn}>💬 {post.commentCount}</button>
      </div>
      {showComments && <Comments postId={post.id} authed={authed} viewerId={viewerId} />}
    </article>
  );
}

function Comments({ postId, authed, viewerId }: { postId: string; authed: boolean; viewerId: string | null }) {
  const [draft, setDraft] = useState('');
  const utils = trpc.useUtils();
  const q = trpc.post.getPostComments.useInfiniteQuery({ postId, limit: 10 }, { getNextPageParam: (last) => last.nextCursor });
  const add = trpc.post.addComment.useMutation({ onSuccess: () => { setDraft(''); void utils.post.getPostComments.invalidate({ postId }); void utils.post.getPosts.invalidate(); } });
  const del = trpc.post.deleteComment.useMutation({ onSuccess: () => { void utils.post.getPostComments.invalidate({ postId }); void utils.post.getPosts.invalidate(); } });
  const comments = q.data?.pages.flatMap((p) => p.comments) ?? [];

  return (
    <div style={s.comments}>
      {authed && (
        <div style={s.commentForm}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="Add a comment…" onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) add.mutate({ postId, content: draft.trim() }); }} style={s.commentInput} />
          <button type="button" disabled={draft.trim().length === 0 || add.isPending} onClick={() => add.mutate({ postId, content: draft.trim() })} style={s.commentBtn}>Send</button>
        </div>
      )}
      {q.isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : comments.length === 0 ? (
        <p style={s.mutedSm}>No comments yet.</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} style={s.comment}>
            <span style={s.avatarSm}>{(c.authorName[0] ?? 'M').toUpperCase()}</span>
            <div style={{ flex: 1 }}>
              <span style={s.cAuthor}>{c.authorName}</span> <span style={s.time}>{relativeTime(c.createdAt)}</span>
              <div style={s.cText}>{c.content}</div>
            </div>
            {viewerId === c.userId && <button type="button" onClick={() => del.mutate({ commentId: c.id })} style={s.delSm}>×</button>}
          </div>
        ))
      )}
      {q.hasNextPage && <button type="button" onClick={() => void q.fetchNextPage()} style={s.moreSm}>More comments</button>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#F4F3EE', padding: 'var(--space-2)' },
  wrap: { width: '100%', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: {},
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, margin: 0, color: '#1A1916' },
  sub: { fontSize: 14, color: '#6b6860', margin: '4px 0 0' },
  compose: { background: '#fff', borderRadius: 12, border: '1px solid #efefe9', padding: 12 },
  textarea: { width: '100%', border: 'none', outline: 'none', fontSize: 15, resize: 'vertical', fontFamily: 'inherit' },
  composeBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  count: { fontSize: 12, color: '#9a9a92' },
  postBtn: { background: '#F5C842', color: '#0F1A1B', border: 'none', borderRadius: 999, padding: '8px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  loginNudge: { background: '#fff', borderRadius: 12, border: '1px solid #efefe9', padding: 14, fontSize: 14, color: '#6b6860', textAlign: 'center' },
  loginLink: { color: '#3A9EA5', fontWeight: 600 },
  muted: { color: '#9a9a92', textAlign: 'center', padding: 20 },
  mutedSm: { color: '#9a9a92', fontSize: 13, padding: '4px 0' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #efefe9', padding: 14 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: '50%', background: '#3A9EA5', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
  avatarSm: { width: 28, height: 28, borderRadius: '50%', background: '#8DC63F', color: '#0F1A1B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  author: { fontWeight: 600, color: '#1A1916', fontSize: 14 },
  time: { fontSize: 12, color: '#9a9a92' },
  del: { background: 'none', border: 'none', color: '#c0392b', fontSize: 12, cursor: 'pointer' },
  delSm: { background: 'none', border: 'none', color: '#c0392b', fontSize: 16, cursor: 'pointer' },
  content: { fontSize: 15, lineHeight: 1.55, color: '#2a2a26', margin: '10px 0', whiteSpace: 'pre-wrap' },
  actions: { display: 'flex', gap: 16, borderTop: '1px solid #f2f2ec', paddingTop: 8 },
  actBtn: { background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: '#6b6860' },
  comments: { marginTop: 10, borderTop: '1px solid #f2f2ec', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  commentForm: { display: 'flex', gap: 8 },
  commentInput: { flex: 1, border: '1px solid #e4e4dd', borderRadius: 999, padding: '8px 14px', fontSize: 14, outline: 'none' },
  commentBtn: { background: '#3A9EA5', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  comment: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  cAuthor: { fontWeight: 600, fontSize: 13, color: '#1A1916' },
  cText: { fontSize: 14, color: '#2a2a26', marginTop: 2, whiteSpace: 'pre-wrap' },
  moreBtn: { background: '#fff', border: '1px solid #d8d8d0', borderRadius: 8, padding: 10, fontSize: 14, cursor: 'pointer' },
  moreSm: { background: 'none', border: 'none', color: '#3A9EA5', fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start' },
};
