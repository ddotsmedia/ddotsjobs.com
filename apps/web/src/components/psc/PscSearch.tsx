'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PscSearch({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);

  function submit() {
    const v = q.trim();
    router.push(v ? `/psc?q=${encodeURIComponent(v)}` : '/psc');
  }

  return (
    <div style={s.row}>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Search posts, departments…"
        aria-label="Search PSC notifications"
        style={s.input}
      />
      <button type="button" onClick={submit} style={s.btn}>
        Search
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  row: { display: 'flex', gap: 'var(--space-1)' },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    padding: '0 14px',
    fontSize: 16,
    background: '#fff',
    border: '1px solid #e2e2dc',
    borderRadius: 'var(--radius-input)',
    outline: 'none',
  },
  btn: {
    height: 48,
    padding: '0 18px',
    fontSize: 15,
    fontWeight: 600,
    color: '#0f0e0c',
    background: 'var(--color-brand)',
    border: 'none',
    borderRadius: 'var(--radius-input)',
    cursor: 'pointer',
  },
};
