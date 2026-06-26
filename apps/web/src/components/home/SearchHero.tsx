'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DISTRICTS, HERO_CHIPS } from '@/lib/constants';

export function SearchHero() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('');
  const [active, setActive] = useState<Set<string>>(new Set());

  function toggleChip(key: string, kind: string, value: string) {
    if (kind === 'link') {
      router.push(value);
      return;
    }
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function submit() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (district) params.set('district', district);
    for (const chip of HERO_CHIPS) {
      if (!active.has(chip.key)) continue;
      if (chip.kind === 'category') params.set('category', chip.value);
      if (chip.kind === 'flag') params.set(chip.value, '1');
    }
    router.push(`/jobs${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <div style={s.wrap}>
      <div className="hp-search" style={s.searchShell}>
        <div style={s.searchRow}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Job title, skill or company"
            aria-label="Search jobs"
            style={s.input}
          />
          <div style={s.searchControls}>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              aria-label="District"
              style={s.select}
            >
              <option value="">All districts</option>
              {DISTRICTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={submit} className="hp-btn" style={s.btn}>
              Search
            </button>
          </div>
        </div>
      </div>

      <div style={s.chips}>
        {HERO_CHIPS.map((c) => {
          const on = active.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleChip(c.key, c.kind, c.value)}
              className="hp-chip"
              style={{
                ...s.chip,
                background: on ? 'rgba(245,168,0,0.12)' : '#fff',
                color: on ? '#A36C00' : '#1A1916',
                borderColor: on ? 'rgba(245,168,0,0.3)' : '#E8E6DF',
                fontWeight: on ? 700 : 500,
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  // Pill-shaped search shell with soft elevation + focus ring (.hp-search).
  searchShell: {
    background: '#fff',
    borderRadius: 50,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    border: '1.5px solid #E8E6DF',
    padding: 5,
  },
  searchRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  searchControls: { display: 'flex', gap: 6 },
  input: {
    height: 58,
    padding: '0 22px',
    fontSize: 16,
    background: 'transparent',
    border: 'none',
    borderRadius: 50,
    outline: 'none',
    width: '100%',
    color: '#1A1916',
  },
  select: {
    height: 58,
    flex: 1,
    minWidth: 0,
    padding: '0 16px',
    fontSize: 16,
    background: '#FAFAF8',
    border: '1px solid #E8E6DF',
    borderRadius: 50,
    outline: 'none',
  },
  btn: {
    height: 58,
    flex: '0 0 auto',
    margin: 0,
    padding: '0 30px',
    fontSize: 16,
    fontWeight: 600,
    color: '#1A1916',
    background: '#F5A800',
    border: 'none',
    borderRadius: 50,
    cursor: 'pointer',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 34,
    padding: '0 16px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #E8E6DF',
    borderRadius: 34,
    cursor: 'pointer',
  },
};
