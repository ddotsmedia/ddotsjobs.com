'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function UnsubscribeClient() {
  const token = useSearchParams().get('token') ?? '';
  const valid = UUID_RE.test(token);
  const unsub = trpc.notifications.unsubscribeByToken.useMutation();
  const fired = useRef(false);

  useEffect(() => {
    if (!valid || fired.current) return;
    fired.current = true;
    unsub.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, valid]);

  const done = unsub.isSuccess && unsub.data?.ok;
  const failed = !valid || (unsub.isSuccess && !unsub.data?.ok) || unsub.isError;

  return (
    <div style={s.card}>
      <div style={s.logo}>ddotsjobs<span style={{ color: '#F5C842' }}>.</span></div>
      {unsub.isPending && <p style={s.msg}>Updating your preferences…</p>}
      {done && (
        <>
          <div style={s.icon} aria-hidden>✓</div>
          <h1 style={s.h1}>Unsubscribed</h1>
          <p style={s.msg}>You won’t receive email notifications from ddotsjobs anymore. You can re-enable them any time from your account.</p>
          <Link href="/seeker/preferences" style={s.btn}>Manage email settings</Link>
        </>
      )}
      {failed && (
        <>
          <h1 style={s.h1}>Link expired or invalid</h1>
          <p style={s.msg}>This unsubscribe link isn’t valid. Manage your email settings from your account instead.</p>
          <Link href="/seeker/preferences" style={s.btn}>Email settings</Link>
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-4)', maxWidth: 440, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' },
  logo: { fontSize: 24, fontWeight: 800, fontStyle: 'italic', color: 'var(--color-accent)' },
  icon: { width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', background: '#1d7a3a', borderRadius: '50%' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.6rem', margin: 0, color: 'var(--color-dark)' },
  msg: { fontSize: 14, color: '#6b6b66', margin: 0, lineHeight: 1.5 },
  btn: { marginTop: 8, padding: '11px 24px', fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
};
