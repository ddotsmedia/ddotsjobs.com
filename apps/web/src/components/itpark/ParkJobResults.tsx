'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import type { JobListItem } from '@/server/routers/jobs';
import { JobCard } from '@/components/jobs/JobCard';

interface Props {
  slug: string;
  parkName: string;
  parkBadge: { label: string; color: string };
  initialItems: JobListItem[];
  initialCursor: string | null;
}

export function ParkJobResults({ slug, parkName, parkBadge, initialItems, initialCursor }: Props) {
  const utils = trpc.useUtils();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await utils.itParks.jobs.fetch({ slug, cursor, limit: 20 });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div style={s.empty}>
        <p style={{ fontWeight: 600 }}>No active jobs at {parkName} right now.</p>
        <p style={{ color: '#6b6b66' }}>Check back soon or set an alert.</p>
        <Link href="/seeker/alerts" style={s.alertBtn}>Set a job alert</Link>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.list}>
        {items.map((j) => (
          <JobCard key={j.id} job={j} parkBadge={parkBadge} />
        ))}
      </div>
      {cursor && (
        <button type="button" onClick={loadMore} disabled={loading} style={s.more}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  more: { alignSelf: 'center', minHeight: 44, padding: '0 28px', fontSize: 15, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' },
  alertBtn: { marginTop: 4, padding: '10px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
};
