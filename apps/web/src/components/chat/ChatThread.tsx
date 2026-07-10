'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { initials, relativeTime } from '@/lib/format';

const TEAL = '#3A9EA5';

export function ChatThread({ conversationId }: { conversationId: string }) {
  const utils = trpc.useUtils();
  const q = trpc.chat.getMessages.useQuery({ conversationId }, { refetchInterval: 3000 });
  const send = trpc.chat.sendMessage.useMutation();
  const del = trpc.chat.deleteMessage.useMutation();
  const block = trpc.chat.blockUser.useMutation();
  const unblock = trpc.chat.unblockUser.useMutation();
  const markRead = trpc.chat.markAsRead.useMutation();

  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const data = q.data;
  const msgs = useMemo(() => data?.messages ?? [], [data]);
  const count = msgs.length;

  // Mark peer messages read whenever the visible set changes.
  useEffect(() => {
    if (!data) return;
    markRead.mutate(
      { conversationId },
      { onSuccess: () => void utils.chat.unreadCount.invalidate() },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, count]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  if (q.isError) {
    return (
      <div style={s.center}>
        <Link href="/chat" style={s.back}>← Messages</Link>
        <p style={s.err}>Conversation not found.</p>
      </div>
    );
  }

  const peer = data?.peer;
  const blocked = data?.blockedByMe ?? false;

  async function onSend() {
    const body = text.trim();
    if (!body || send.isPending) return;
    setError(null);
    setText('');
    try {
      await send.mutateAsync({ conversationId, content: body });
      await utils.chat.getMessages.invalidate({ conversationId });
    } catch (e) {
      setText(body); // restore on failure
      const msg = (e as { message?: string })?.message ?? '';
      setError(/rate limit/i.test(msg) ? 'Daily message limit reached (50/day).' : /blocked/i.test(msg) ? 'Messaging is blocked.' : 'Could not send. Try again.');
    }
  }

  return (
    <div style={s.wrap}>
      <header style={s.header}>
        <Link href="/chat" style={s.backIcon} aria-label="Back">←</Link>
        <span style={s.avatar} aria-hidden>{initials(peer?.name ?? 'U')}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.peerName}>{peer?.name ?? 'User'}</div>
          <span style={s.roleBadge}>{peer?.role === 'employer' ? 'Employer' : peer?.role === 'admin' ? 'Admin' : 'Job seeker'}</span>
        </div>
        <div style={s.menuWrap}>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} style={s.menuBtn} aria-label="Options">⋮</button>
          {menuOpen && (
            <div style={s.menu} onMouseLeave={() => setMenuOpen(false)}>
              {blocked ? (
                <button type="button" style={s.menuItem} onClick={() => { unblock.mutate({ userId: peer!.id }, { onSuccess: () => void utils.chat.getMessages.invalidate({ conversationId }) }); setMenuOpen(false); }}>Unblock</button>
              ) : (
                <button type="button" style={{ ...s.menuItem, color: '#c0392b' }} onClick={() => { block.mutate({ userId: peer!.id }, { onSuccess: () => void utils.chat.getMessages.invalidate({ conversationId }) }); setMenuOpen(false); }}>Block user</button>
              )}
            </div>
          )}
        </div>
      </header>

      <div ref={scrollRef} style={s.scroll}>
        {q.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : count === 0 ? (
          <div style={s.emptyThread}><p style={{ fontWeight: 600 }}>Start the conversation!</p><p style={s.muted}>Say hello 👋</p></div>
        ) : (
          msgs.map((m) => (
            <div key={m.id} style={{ ...s.bubbleRow, justifyContent: m.mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ ...s.bubble, ...(m.mine ? s.bubbleMine : s.bubbleTheirs), ...(m.deleted ? s.bubbleDeleted : {}) }}>
                <span style={s.content}>{m.deleted ? 'Message deleted' : m.content}</span>
                <span style={s.metaLine}>
                  <span style={s.time}>{relativeTime(m.createdAt)}</span>
                  {m.mine && !m.deleted && <span style={s.receipt}>{m.readAt ? '✓✓' : '✓'}</span>}
                  {m.mine && !m.deleted && (
                    <button type="button" onClick={() => del.mutate({ messageId: m.id }, { onSuccess: () => void utils.chat.getMessages.invalidate({ conversationId }) })} style={s.delBtn} aria-label="Delete message">🗑</button>
                  )}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {blocked ? (
        <div style={s.blockedBar}>You blocked this user. Unblock to message.</div>
      ) : (
        <div style={s.inputBar}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
            placeholder="Type a message…"
            rows={1}
            style={s.textarea}
            maxLength={500}
          />
          <button type="button" onClick={() => void onSend()} disabled={!text.trim() || send.isPending} style={s.sendBtn} aria-label="Send">➤</button>
        </div>
      )}
      {error && <p style={s.errLine}>{error}</p>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 720, margin: '0 auto', background: '#fff' },
  center: { padding: 'var(--space-3)', textAlign: 'center' },
  back: { color: TEAL, fontWeight: 600, fontSize: 14 },
  err: { color: '#c0392b', marginTop: 12 },
  header: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #efefe9', position: 'sticky', top: 0, background: '#fff', zIndex: 5 },
  backIcon: { fontSize: 22, color: '#55554f', width: 32, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: TEAL, background: '#eef6f5', borderRadius: '50%' },
  peerName: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  roleBadge: { fontSize: 11, fontWeight: 600, color: '#6b6b66' },
  menuWrap: { position: 'relative' },
  menuBtn: { fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', width: 44, height: 44, color: '#6b6b66' },
  menu: { position: 'absolute', right: 0, top: 44, background: '#fff', border: '1px solid #e2e2da', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.1)', zIndex: 10, minWidth: 140 },
  menuItem: { display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#2a2a26' },
  scroll: { flex: 1, overflowY: 'auto', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 8, background: '#fafaf7' },
  muted: { color: '#8a8a83', fontSize: 14, textAlign: 'center' },
  emptyThread: { margin: 'auto', textAlign: 'center', color: '#6b6b66' },
  bubbleRow: { display: 'flex' },
  bubble: { maxWidth: '78%', padding: '8px 12px', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 4 },
  bubbleMine: { background: '#dff3f2', borderBottomRightRadius: 4 },
  bubbleTheirs: { background: '#fff', border: '1px solid #eee', borderBottomLeftRadius: 4 },
  bubbleDeleted: { opacity: 0.6, fontStyle: 'italic' },
  content: { fontSize: 15, color: '#1a1916', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  metaLine: { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  time: { fontSize: 11, color: '#9a9a92' },
  receipt: { fontSize: 12, color: TEAL, fontWeight: 700 },
  delBtn: { fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: 0 },
  inputBar: { display: 'flex', gap: 8, alignItems: 'flex-end', padding: 10, borderTop: '1px solid #efefe9', position: 'sticky', bottom: 0, background: '#fff' },
  textarea: { flex: 1, resize: 'none', minHeight: 44, maxHeight: 120, padding: '11px 14px', fontSize: 15, border: '1px solid #e2e2da', borderRadius: 22, fontFamily: 'inherit', lineHeight: 1.3 },
  sendBtn: { flex: '0 0 auto', width: 44, height: 44, borderRadius: '50%', border: 'none', background: TEAL, color: '#fff', fontSize: 16, cursor: 'pointer' },
  blockedBar: { padding: 14, textAlign: 'center', fontSize: 13, color: '#6b6b66', borderTop: '1px solid #efefe9', background: '#faf4f3' },
  errLine: { color: '#c0392b', fontSize: 13, textAlign: 'center', padding: '4px 0' },
};
