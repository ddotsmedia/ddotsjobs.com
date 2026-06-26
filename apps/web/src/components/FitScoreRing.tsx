import type { FitScoreResult } from '@/lib/services/fit-score.service';

const SIZES = { sm: 64, md: 96, lg: 132 } as const;

function ringColor(score: number): string {
  if (score >= 80) return '#F5C842';
  if (score >= 60) return '#3A9EA5';
  return '#B0AD9F';
}

const REC: Record<string, { label: string; color: string; bg: string }> = {
  strong_match: { label: 'Strong match', color: '#1d7a3a', bg: '#e6f5ea' },
  apply: { label: 'Good match', color: '#9a6b00', bg: '#fdf0d5' },
  consider: { label: 'Partial match', color: '#6b6b66', bg: '#f1f1ec' },
  mismatch: { label: 'Low match', color: '#c0392b', bg: '#fdecea' },
};

export function FitScoreRing({
  score,
  breakdown,
  size = 'md',
}: {
  score: number;
  breakdown?: FitScoreResult;
  language?: 'ml' | 'en';
  size?: 'sm' | 'md' | 'lg';
}) {
  const px = SIZES[size];
  const stroke = size === 'sm' ? 6 : 8;
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  const color = ringColor(score);
  const rec = breakdown ? REC[breakdown.recommendation] : null;

  const bars: { label: string; value: number }[] = breakdown
    ? [
        { label: 'Qualification', value: breakdown.qualification },
        { label: 'Experience', value: breakdown.experience },
        { label: 'Location', value: breakdown.location },
        { label: 'Salary', value: breakdown.salary },
        { label: 'Language', value: breakdown.language },
      ]
    : [];

  return (
    <div style={s.wrap}>
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} role="img" aria-label={`Fit score ${score}`}>
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="#ececdf" strokeWidth={stroke} />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${px / 2} ${px / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={px * 0.28} fontWeight={700} fill="#0F0E0C">
          {score}
        </text>
      </svg>

      {rec && (
        <span style={{ ...s.badge, color: rec.color, background: rec.bg }}>{rec.label}</span>
      )}

      {bars.length > 0 && (
        <div style={s.bars}>
          {bars.map((b) => (
            <div key={b.label} style={s.barRow}>
              <span style={s.barLabel}>{b.label}</span>
              <div style={s.barTrack}>
                <div style={{ ...s.barFill, width: `${b.value}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  badge: { fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: '9999px' },
  bars: { width: '100%', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  barRow: { display: 'flex', flexDirection: 'column', gap: 2 },
  barLabel: { fontSize: 11, color: '#6b6b66' },
  barTrack: { width: '100%', height: 4, background: '#ececdf', borderRadius: 999 },
  barFill: { height: 4, borderRadius: 999, transition: 'width 0.6s ease' },
};
