'use client';

import { useCompare } from '@/lib/useCompare';

// Small "Compare" toggle button. Placed as a sibling of the job-card Link.
export function CompareToggle({ jobId, variant = 'card', stacked = false }: { jobId: string; variant?: 'card' | 'detail'; stacked?: boolean }) {
  const { has, toggle, full } = useCompare();
  const on = has(jobId);
  const disabled = !on && full;
  // When a save-heart occupies the top-right corner, drop the card toggle below it.
  const base = variant === 'detail' ? s.detail : stacked ? { ...s.card, top: 52 } : s.card;
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(jobId); }}
      disabled={disabled}
      title={disabled ? 'Compare up to 3 jobs' : on ? 'Remove from comparison' : 'Add to comparison'}
      style={{ ...base, ...(on ? s.on : {}), ...(disabled ? s.disabled : {}) }}
    >
      {on ? '✓ Comparing' : '⇄ Compare'}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { position: 'absolute', top: 10, right: 10, zIndex: 2, background: '#fff', border: '1px solid #d8d8d0', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#6b6860', cursor: 'pointer' },
  detail: { width: '100%', background: '#fff', border: '1px solid #d8d8d0', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 600, color: '#3A9EA5', cursor: 'pointer', marginTop: 8 },
  on: { background: '#3A9EA5', color: '#fff', borderColor: '#3A9EA5' },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
};
