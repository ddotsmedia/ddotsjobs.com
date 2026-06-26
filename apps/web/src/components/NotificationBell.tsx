'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { relativeTime } from '@/lib/format';

function truncate(s: string | null, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function NotificationBell({ viewAllHref }: { viewAllHref: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const unread = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30_000 });
  const list = trpc.notifications.list.useQuery({ limit: 5 }, { enabled: open });
  const markRead = trpc.notifications.markRead.useMutation();
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      void utils.notifications.unreadCount.invalidate();
      void utils.notifications.list.invalidate();
    },
  });

  const count = unread.data?.count ?? 0;

  function onItem(id: string, isRead: boolean, url: string | null) {
    if (!isRead) {
      markRead.mutate({ notificationId: id }, {
        onSuccess: () => void utils.notifications.unreadCount.invalidate(),
      });
    }
    setOpen(false);
    if (url) router.push(url);
  }

  return (
    <div style={s.wrap}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Notifications" style={s.bell}>
        🔔
        {count > 0 && <span style={s.badge}>{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <>
          <div style={s.backdrop} onClick={() => setOpen(false)} />
          <div style={s.dropdown}>
            <div style={s.dropHead}>
              <strong style={{ fontSize: 14 }}>Notifications</strong>
              <button type="button" onClick={() => markAll.mutate()} style={s.markAll}>Mark all read</button>
            </div>
            <div style={s.items}>
              {(list.data?.items ?? []).length === 0 ? (
                <p style={s.empty}>No notifications yet.</p>
              ) : (
                list.data!.items.map((nt) => (
                  <button key={nt.id} type="button" onClick={() => onItem(nt.id, nt.isRead, nt.actionUrl)} style={s.item}>
                    {!nt.isRead && <span style={s.dot} aria-hidden />}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ ...s.title, fontWeight: nt.isRead ? 500 : 700 }}>{nt.title}</span>
                      <span style={s.body}>{truncate(nt.body, 60)}</span>
                      <span style={s.time}>{relativeTime(nt.createdAt)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <Link href={viewAllHref} onClick={() => setOpen(false)} style={s.viewAll}>View all →</Link>
          </div>
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative' },
  bell: { position: 'relative', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', minWidth: 40, minHeight: 40 },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', background: '#c0392b', borderRadius: '9999px' },
  backdrop: { position: 'fixed', inset: 0, zIndex: 50 },
  dropdown: { position: 'absolute', top: 44, right: 0, width: 300, maxWidth: '80vw', zIndex: 60, background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #e2e2dc', boxShadow: '0 4px 16px rgba(15,14,12,0.12)', overflow: 'hidden' },
  dropHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2)', borderBottom: '1px solid #f1f1ec' },
  markAll: { fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' },
  items: { maxHeight: 320, overflowY: 'auto' },
  empty: { padding: 'var(--space-2)', fontSize: 13, color: '#9a9a92', textAlign: 'center' },
  item: { display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', padding: '10px var(--space-2)', background: 'none', border: 'none', borderBottom: '1px solid #f4f4ef', cursor: 'pointer', textAlign: 'left' },
  dot: { width: 8, height: 8, borderRadius: '9999px', background: 'var(--color-brand)', marginTop: 5, flex: '0 0 auto' },
  title: { display: 'block', fontSize: 13, color: 'var(--color-dark)' },
  body: { display: 'block', fontSize: 12, color: '#6b6b66', marginTop: 1 },
  time: { display: 'block', fontSize: 11, color: '#9a9a92', marginTop: 1 },
  viewAll: { display: 'block', textAlign: 'center', padding: '10px', fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' },
};
