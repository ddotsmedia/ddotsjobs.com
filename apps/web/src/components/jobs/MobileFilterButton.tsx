'use client';

import { useState } from 'react';
import { activeFilterCount, type JobFilters } from '@/lib/jobFilters';
import { FilterPanel } from './FilterPanel';

// Mobile-only: opens the filter panel as a bottom sheet.
export function MobileFilterButton({ initial }: { initial: JobFilters }) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(initial);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={s.trigger} className="ddj-mobile-only">
        Filters
        {count > 0 && <span style={s.badge}>{count}</span>}
      </button>

      {open && (
        <div style={s.overlay} onClick={() => setOpen(false)}>
          <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={s.handleRow}>
              <span style={s.sheetTitle}>Filters</span>
              <button type="button" onClick={() => setOpen(false)} style={s.close} aria-label="Close">
                ✕
              </button>
            </div>
            <div style={s.sheetBody}>
              <FilterPanel initial={initial} onApplied={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    padding: '0 18px',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--color-dark)',
    background: '#fff',
    border: '1px solid #e2e2dc',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
  badge: {
    minWidth: 20,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    background: 'var(--color-accent)',
    borderRadius: 'var(--radius-pill)',
    padding: '0 6px',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,14,12,0.4)',
    zIndex: 60,
    display: 'flex',
    alignItems: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '85dvh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-neutral)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  handleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-2)',
    borderBottom: '1px solid #ececdf',
  },
  sheetTitle: { fontSize: 16, fontWeight: 700 },
  close: { fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44 },
  sheetBody: { overflowY: 'auto', padding: 'var(--space-2)' },
};
