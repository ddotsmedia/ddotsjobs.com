// Server-safe star display (0–5, supports halves visually by rounding).
export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span role="img" aria-label={`${value.toFixed(1)} out of 5`} style={{ display: 'inline-flex', gap: 1, fontSize: size, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= rounded ? '#F5C842' : '#d8d8d0' }}>★</span>
      ))}
    </span>
  );
}
