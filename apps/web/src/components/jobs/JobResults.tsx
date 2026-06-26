'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import type { JobListItem, JobsListInput } from '@/server/routers/jobs';
import { JobCard } from './JobCard';

interface Props {
  initialItems: JobListItem[];
  initialCursor: string | null;
  input: Omit<JobsListInput, 'cursor' | 'limit'>;
}

export function JobResults({ initialItems, initialCursor, input }: Props) {
  const utils = trpc.useUtils();
  const [items, setItems] = useState<JobListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await utils.jobs.list.fetch({ ...input, cursor, limit: 20 });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div style={s.empty}>
        <p style={{ fontWeight: 600 }}>No jobs found.</p>
        <p style={{ color: '#6b6b66' }}>Try different filters.</p>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.list}>
        {items.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
      {cursor && (
        <button type="button" onClick={loadMore} disabled={loading} style={s.more}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
      {error && <p style={s.err}>Could not load more. Tap to retry.</p>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  more: {
    alignSelf: 'center',
    minHeight: 44,
    padding: '0 28px',
    fontSize: 15,
    fontWeight: 600,
    color: '#0f0e0c',
    background: 'var(--color-brand)',
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
  err: { textAlign: 'center', color: '#c0392b', fontSize: 13 },
  empty: {
    padding: 'var(--space-4)',
    textAlign: 'center',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    border: '1px dashed #d8d8d0',
  },
};
