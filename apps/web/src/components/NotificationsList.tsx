'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { inferRouterOutputs } from '@trpc/server';
import { trpc } from '@/lib/trpc/client';
import type { AppRouter } from '@/server/routers/_app';
import { relativeTime } from '@/lib/format';

type Item = inferRouterOutputs<AppRouter>['notifications']['list']['items'][number];

// Emoji per notification type.
function typeIcon(type: string): string {
  if (type.includes('shortlist')) return '🎉';
  if (type.includes('interview')) return '📅';
  if (type.includes('verified') || type.includes('verification')) return '✅';
  if (type.includes('job.published') || type.includes('job.approved')) return '📢';
  if (type.includes('contact')) return '💬';
  if (type.includes('rejected')) return '🚫';
  if (type.includes('subscription')) return '⭐';
  if (type.includes('pending')) return '⏳';
  return '🔔';
}

export function NotificationsList() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [extra, setExtra] = useState<Item[]>([]);
  const [moreCursor, setMoreCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = trpc.notifications.list.useQuery({ unreadOnly, limit: 20 });
  const markRead = trpc.notifications.markRead.useMutation();
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      setExtra([]);
      setMoreCursor(null);
      void utils.notifications.list.invalidate();
      void utils.notifications.unreadCount.invalidate();
    },
  });

  const items = [...(query.data?.items ?? []), ...extra];
  const cursor = extra.length > 0 ? moreCursor : (query.data?.nextCursor ?? null);

  function switchFilter(v: boolean) {
    setUnreadOnly(v);
    setExtra([]);
    setMoreCursor(null);
  }
  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await utils.notifications.list.fetch({ unreadOnly, cursor, limit: 20 });
      setExtra((p) => [...p, ...res.items]);
      setMoreCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }
  function onItem(it: Item) {
    if (!it.isRead) {
      markRead.mutate({ notificationId: it.id }, {
        onSuccess: () => void utils.notifications.unreadCount.invalidate(),
      });
    }
    if (it.actionUrl) router.push(it.actionUrl);
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.head}>
          <h1 style={s.h1}>Notifications</h1>
          <button type="button" onClick={() => markAll.mutate()} style={s.markAll}>Mark all read</button>
        </div>
        <div style={s.tabs}>
          {([['all', false], ['unread', true]] as const).map(([k, v]) => (
            <button key={k} type="button" onClick={() => switchFilter(v)} style={{ ...s.tab, ...(unreadOnly === v ? s.tabOn : {}) }}>
              {k === 'all' ? 'All' : 'Unread'}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div style={s.empty}>No notifications yet.</div>
        ) : (
          <div style={s.list}>
            {items.map((it) => (
              <button key={it.id} type="button" onClick={() => onItem(it)} style={{ ...s.item, background: it.isRead ? '#fff' : '#fffdf5' }}>
                <span style={s.icon} aria-hidden>{typeIcon(it.type)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ ...s.title, fontWeight: it.isRead ? 500 : 700 }}>{it.title}</span>
                  {it.body && <span style={s.body}>{it.body}</span>}
                  <span style={s.time}>{relativeTime(it.createdAt)}</span>
                </span>
                {!it.isRead && <span style={s.dot} aria-hidden />}
              </button>
            ))}
          </div>
        )}

        {cursor && items.length > 0 && (
          <button type="button" onClick={loadMore} disabled={loading} style={s.more}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 600, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.4rem)', margin: 0 },
  markAll: { fontSize: 13, fontWeight: 600, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' },
  tabs: { display: 'flex', gap: 8 },
  tab: { minHeight: 38, padding: '0 16px', fontSize: 14, fontWeight: 600, background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  tabOn: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', color: '#6b6b66' },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  item: { display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', cursor: 'pointer', textAlign: 'left' },
  icon: { fontSize: 20, lineHeight: 1, flex: '0 0 auto', marginTop: 1 },
  dot: { width: 9, height: 9, borderRadius: '9999px', background: 'var(--color-brand)', marginTop: 5, flex: '0 0 auto' },
  title: { display: 'block', fontSize: 15, color: 'var(--color-dark)' },
  body: { display: 'block', fontSize: 13, color: '#55554f', marginTop: 2 },
  time: { display: 'block', fontSize: 12, color: '#9a9a92', marginTop: 2 },
  more: { alignSelf: 'center', minHeight: 44, padding: '0 28px', fontSize: 15, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
};
