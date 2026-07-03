'use client';

import { useRouter } from 'next/navigation';
import { useCompare } from '@/lib/useCompare';

// Floating bar shown when 1+ jobs are selected for comparison.
export function CompareTray() {
  const router = useRouter();
  const { ids, clear } = useCompare();
  if (ids.length === 0) return null;
  const ready = ids.length >= 2;
  return (
    <div style={s.tray}>
      <span style={s.count}>{ids.length} selected {ready ? '' : '· pick at least 2'}</span>
      <button type="button" onClick={clear} style={s.clear}>Clear</button>
      <button type="button" disabled={!ready} onClick={() => router.push(`/compare?ids=${ids.join(',')}`)} style={{ ...s.go, ...(ready ? {} : s.disabled) }}>
        Compare ({ids.length})
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tray: { position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 900, display: 'flex', alignItems: 'center', gap: 10, background: '#0F1A1B', color: '#fff', borderRadius: 999, padding: '10px 16px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)', maxWidth: '92vw' },
  count: { fontSize: 13 },
  clear: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' },
  go: { background: '#F5C842', color: '#0F1A1B', border: 'none', borderRadius: 999, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
};
