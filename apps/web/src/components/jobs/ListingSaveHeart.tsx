'use client';

// Compact icon-only heart for listing cards. Purely presentational — the parent
// (JobResults) owns saved state and the toggle mutation. Rendered only for
// authenticated users, so the ISR-cached anonymous HTML is unaffected.
export function ListingSaveHeart({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Saved' : 'Save job'}
      title={saved ? 'Saved' : 'Save job for later'}
      style={{ ...s.heart, color: saved ? 'var(--color-brand)' : '#9a9a92' }}
    >
      {saved ? '♥' : '♡'}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  heart: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
    width: 36,
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    lineHeight: 1,
    background: '#fff',
    border: '1px solid #d8d8d0',
    borderRadius: '50%',
    cursor: 'pointer',
  },
};
