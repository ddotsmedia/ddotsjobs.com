// Ddotsmedia brand mark. The "dots" use the four brand colours. Rendered as
// inline SVG so it needs no binary asset; drop a real /logo.png in to swap.

type Variant = 'full' | 'text' | 'icon';

function Mark({ size = 32 }: { size?: number }) {
  const r = size * 0.16;
  const a = size * 0.3;
  const b = size * 0.7;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="ddotsjobs" style={{ flex: '0 0 auto' }}>
      <circle cx={a} cy={a} r={r} fill="#3A9EA5" />
      <circle cx={b} cy={a} r={r} fill="#F5C842" />
      <circle cx={a} cy={b} r={r} fill="#8DC63F" />
      <circle cx={b} cy={b} r={r} fill="#E8623A" />
    </svg>
  );
}

export function Logo({
  variant = 'full',
  size = 32,
  color = '#3A9EA5',
}: {
  variant?: Variant;
  size?: number;
  color?: string;
}) {
  if (variant === 'icon') return <Mark size={size} />;
  const word = (
    <span
      style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: size * 0.62,
        letterSpacing: '-0.02em',
        color,
      }}
    >
      ddotsjobs
    </span>
  );
  if (variant === 'text') return word;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28 }}>
      <Mark size={size} />
      {word}
    </span>
  );
}
