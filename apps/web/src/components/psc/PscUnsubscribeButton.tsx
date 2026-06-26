'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';

export function PscUnsubscribeButton({ categoryNo }: { categoryNo: string }) {
  const router = useRouter();
  const unsubscribe = trpc.psc.unsubscribe.useMutation({ onSuccess: () => router.refresh() });
  return (
    <button
      type="button"
      disabled={unsubscribe.isPending}
      onClick={() => unsubscribe.mutate({ categoryNo })}
      style={s.btn}
    >
      {unsubscribe.isPending ? '…' : 'Unsubscribe'}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  btn: {
    minHeight: 36,
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#c0392b',
    background: '#fff',
    border: '1px solid #f0d3cf',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
};
