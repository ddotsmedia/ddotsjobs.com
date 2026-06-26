'use client';

import { useState } from 'react';

// English | Malayalam description tabs. Plain text rendered with line breaks.
export function DescriptionTabs({
  en,
  ml,
}: {
  en: string;
  ml: string | null;
}) {
  const hasMl = Boolean(ml && ml.trim());
  const [tab, setTab] = useState<'en' | 'ml'>('en');
  const active = tab === 'ml' && hasMl ? ml! : en;

  return (
    <div>
      <div style={s.tabs}>
        <button
          type="button"
          onClick={() => setTab('en')}
          style={{ ...s.tab, ...(tab === 'en' ? s.tabActive : {}) }}
        >
          English
        </button>
        {hasMl && (
          <button
            type="button"
            onClick={() => setTab('ml')}
            style={{ ...s.tab, ...(tab === 'ml' ? s.tabActive : {}) }}
          >
            മലയാളം
          </button>
        )}
      </div>
      <p style={s.body}>{active}</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tabs: { display: 'flex', gap: 4, marginBottom: 'var(--space-1)' },
  tab: {
    minHeight: 40,
    padding: '0 16px',
    fontSize: 14,
    fontWeight: 600,
    color: '#6b6b66',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
  },
  tabActive: { color: 'var(--color-accent)', borderBottom: '2px solid var(--color-accent)' },
  body: { fontSize: 15, lineHeight: 1.7, color: '#33332f', whiteSpace: 'pre-wrap' },
};
