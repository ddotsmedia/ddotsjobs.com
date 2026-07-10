'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

// Opens (or creates) a chat with the job's employer. Auth-gated: anonymous
// users are routed to login. Employers/admins don't see it (page gates).
export function MessageEmployerButton({ employerId, slug, authed }: { employerId: string; slug: string; authed: boolean }) {
  const router = useRouter();
  const start = trpc.chat.startConversationWithEmployer.useMutation({
    onSuccess: (r) => router.push(`/chat/${r.conversationId}`),
  });

  if (!authed) {
    return <Link href={`/login?redirect=/jobs/${slug}`} style={s.btn}>💬 Message employer</Link>;
  }
  return (
    <button type="button" onClick={() => start.mutate({ employerId })} disabled={start.isPending} style={s.btn}>
      {start.isPending ? 'Opening…' : '💬 Message employer'}
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
    color: 'var(--color-accent)',
    background: '#fff',
    border: '1px solid var(--color-accent)',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
};
