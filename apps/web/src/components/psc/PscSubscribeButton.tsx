'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

export function PscSubscribeButton({
  categoryNo,
  authed,
  isSeeker,
  initialSubscribed,
}: {
  categoryNo: string;
  authed: boolean;
  isSeeker: boolean;
  initialSubscribed: boolean;
}) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const subscribe = trpc.psc.subscribe.useMutation({ onSuccess: () => setSubscribed(true) });
  const unsubscribe = trpc.psc.unsubscribe.useMutation({ onSuccess: () => setSubscribed(false) });

  if (!authed) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/login?redirect=${encodeURIComponent(`/psc/${categoryNo}`)}`)}
        style={s.btn}
      >
        Subscribe for alerts
      </button>
    );
  }
  if (!isSeeker) {
    return (
      <button type="button" disabled style={{ ...s.btn, ...s.disabled }}>
        Seeker account only
      </button>
    );
  }

  const busy = subscribe.isPending || unsubscribe.isPending;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        subscribed ? unsubscribe.mutate({ categoryNo }) : subscribe.mutate({ categoryNo })
      }
      style={{ ...s.btn, ...(subscribed ? s.subscribed : {}) }}
    >
      {busy ? '…' : subscribed ? '✓ Subscribed (tap to remove)' : 'Subscribe for alerts'}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  btn: {
    width: '100%',
    minHeight: 48,
    fontSize: 15,
    fontWeight: 600,
    color: '#0f0e0c',
    background: 'var(--color-brand)',
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
  subscribed: { background: '#e6f5ea', color: '#1d7a3a' },
  disabled: { background: '#f1f1ec', color: '#9a9a92', cursor: 'not-allowed' },
};
