'use client';

import { trpc } from '@/lib/trpc/client';

export function EmployerMetrics() {
  const m = trpc.employerDashboard.metrics.useQuery(undefined, { refetchInterval: 60_000 });
  const cards = [
    { label: 'New applicants today', value: m.data ? String(m.data.newApplicantsToday) : '…' },
    { label: 'Active job posts', value: m.data ? String(m.data.activeJobCount) : '…' },
    { label: 'Avg fit score this week', value: m.data ? (m.data.avgFitScoreThisWeek != null ? String(m.data.avgFitScoreThisWeek) : '—') : '…' },
    { label: 'WA candidates notified today', value: m.data ? String(m.data.waPushedToday) : '…' },
  ];
  return (
    <div style={s.grid}>
      {cards.map((c) => (
        <div key={c.label} style={s.card}>
          <span style={s.value}>{c.value}</span>
          <span style={s.label}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-1)' },
  card: { display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  value: { fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-accent)' },
  label: { fontSize: 12, color: '#6b6b66' },
};
