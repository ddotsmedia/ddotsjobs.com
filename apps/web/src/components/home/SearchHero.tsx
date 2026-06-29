'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { DISTRICTS, HERO_CHIPS } from '@/lib/constants';

// Malayalam suffix per chip (Unicode, no transliteration).
const CHIP_ML: Record<string, string> = {
  nursing: 'നഴ്‌സിംഗ്',
  it: 'ഐ.ടി',
  teaching: 'അദ്ധ്യാപനം',
  walk_in: 'നേരിട്ട്',
  gulf_return: 'ഗൾഫ് തിരിച്ചുവരവ്',
  psc: 'കേരള PSC',
};

export function SearchHero() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('');
  const [active, setActive] = useState<Set<string>>(new Set());
  const [parsing, setParsing] = useState(false);
  const aiSearch = trpc.jobs.aiSearch.useMutation();

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

  function baseParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    for (const chip of HERO_CHIPS) {
      if (!active.has(chip.key)) continue;
      if (chip.kind === 'category') params.set('category', chip.value);
      if (chip.kind === 'flag') params.set(chip.value, '1');
    }
    return params;
  }

  async function submit() {
    const query = q.trim();
    const params = baseParams();
    // Smart search: try AI natural-language parse first; fall back to text q.
    if (query && !district && active.size === 0) {
      setParsing(true);
      try {
        const r = await aiSearch.mutateAsync({ query });
        if (r.confidence > 0.7) {
          if (r.category) params.set('category', r.category);
          if (r.district) params.set('district', r.district);
          if (r.salaryMin) params.set('salaryMin', String(r.salaryMin));
          if (r.jobType) params.set('type', r.jobType);
          if (r.isWalkIn) params.set('type', 'walk_in');
          router.push(`/jobs?${params.toString()}`);
          return;
        }
      } catch {
        // fall through to text search
      } finally {
        setParsing(false);
      }
    }
    if (query) params.set('q', query);
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
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            placeholder="Try: nurse jobs ernakulam above ₹30,000"
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
            <button type="button" onClick={() => void submit()} disabled={parsing} className="hp-btn" style={s.btn}>
              {parsing ? '…' : 'Search'}
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
                background: on ? '#3A9EA5' : '#fff',
                color: on ? '#fff' : '#0F1A1B',
                borderColor: on ? '#3A9EA5' : '#E2E8E8',
                fontWeight: on ? 600 : 500,
              }}
            >
              {c.label}
              {CHIP_ML[c.key] && <span style={s.chipMl}> · {CHIP_ML[c.key]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  // Rounded-rectangle search shell with strong elevation + focus ring (.hp-search).
  searchShell: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(58,158,165,0.12)',
    border: '2px solid rgba(58,158,165,0.2)',
    padding: 8,
    paddingLeft: 20,
  },
  searchRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  searchControls: { display: 'flex', gap: 8 },
  input: {
    height: 48,
    padding: 0,
    fontSize: 16,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    width: '100%',
    color: '#0F1A1B',
  },
  select: {
    height: 48,
    flex: 1,
    minWidth: 0,
    padding: '0 12px',
    fontSize: 15,
    background: '#FAFAF8',
    border: '1px solid #E2E8E8',
    borderRadius: 12,
    outline: 'none',
  },
  btn: {
    height: 48,
    flex: '0 0 auto',
    margin: 0,
    padding: '0 28px',
    fontSize: 15,
    fontWeight: 700,
    color: '#0F1A1B',
    background: '#F5C842',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    padding: '0 14px',
    fontSize: 13,
    fontWeight: 500,
    border: '1.5px solid #E2E8E8',
    borderRadius: 8,
    cursor: 'pointer',
  },
  chipMl: { fontSize: 11, color: '#9a9a92' },
};
