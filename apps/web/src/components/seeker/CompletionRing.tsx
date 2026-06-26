// SVG completion ring (0-100). Server-safe.
export function CompletionRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ececdf" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#F5A800"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.26} fontWeight={700} fill="#0F0E0C">
        {clamped}%
      </text>
    </svg>
  );
}
