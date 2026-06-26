'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { filtersToQuery, type JobFilters, type SortMode } from '@/lib/jobFilters';

export function SearchSortBar({ initial, total }: { initial: JobFilters; total: number }) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q ?? '');

  function apply(next: JobFilters) {
    const qs = filtersToQuery(next);
    router.push(qs ? `/jobs?${qs}` : '/jobs');
  }

  return (
    <div style={s.wrap}>
      <div style={s.searchRow}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply({ ...initial, q: q.trim() || undefined })}
          placeholder="Job title, skill or company"
          aria-label="Search jobs"
          style={s.input}
        />
        <button
          type="button"
          onClick={() => apply({ ...initial, q: q.trim() || undefined })}
          style={s.btn}
        >
          Search
        </button>
      </div>
      <div style={s.metaRow}>
        <span style={s.count}>{total.toLocaleString('en-IN')} jobs found</span>
        <select
          value={initial.sort}
          onChange={(e) => apply({ ...initial, sort: e.target.value as SortMode })}
          aria-label="Sort"
          style={s.sort}
        >
          <option value="latest">Latest</option>
          <option value="salary_desc">Salary: high to low</option>
          <option value="salary_asc">Salary: low to high</option>
        </select>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  searchRow: { display: 'flex', gap: 'var(--space-1)' },
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
  metaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  count: { fontSize: 14, color: '#55554f' },
  sort: {
    height: 40,
    padding: '0 10px',
    fontSize: 14,
    background: '#fff',
    border: '1px solid #e2e2dc',
    borderRadius: 'var(--radius-input)',
  },
};
