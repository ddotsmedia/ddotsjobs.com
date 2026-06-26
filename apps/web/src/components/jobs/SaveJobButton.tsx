'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

// Heart toggle. Requires auth: unauthenticated taps route to login.
export function SaveJobButton({
  jobId,
  slug,
  authed,
  initialSaved,
}: {
  jobId: string;
  slug: string;
  authed: boolean;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const toggle = trpc.jobs.toggleSave.useMutation({
    onSuccess: (r) => setSaved(r.saved),
  });

  function onClick() {
    if (!authed) {
      router.push(`/login?redirect=${encodeURIComponent(`/jobs/${slug}`)}`);
      return;
    }
    setSaved((v) => !v); // optimistic
    toggle.mutate({ jobId });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Saved' : 'Save job'}
      style={{ ...s.btn, color: saved ? 'var(--color-brand)' : '#6b6b66' }}
    >
      <span aria-hidden>{saved ? '♥' : '♡'}</span>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    minHeight: 44,
    fontSize: 15,
    fontWeight: 600,
    background: '#fff',
    border: '1px solid #e2e2dc',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
};
