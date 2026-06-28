'use client';

import { useEffect, useRef, useState } from 'react';

interface Stat {
  value: number | null; // null → use `text` verbatim (no count-up)
  text?: string;
  label: string;
  sub: string;
}

function useCountUp(target: number, run: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (target <= 0) {
      setN(0);
      return;
    }
    const dur = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return n;
}

function Cell({ stat, run }: { stat: Stat; run: boolean }) {
  const counted = useCountUp(stat.value ?? 0, run);
  const display = stat.value == null ? (stat.text ?? '') : counted.toLocaleString('en-IN');
  return (
    <div style={s.cell}>
      <span style={s.value}>{display}</span>
      <span style={s.underline} />
      <span style={s.label}>{stat.label}</span>
      <span style={s.sub}>{stat.sub}</span>
    </div>
  );
}

export function StatsStrip({ stats }: { stats: { activeJobs: number; verifiedEmployers: number; placements: number; whatsapp: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRun(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cells: Stat[] = [
    { value: stats.activeJobs, label: 'Active jobs', sub: 'across 14 districts' },
    { value: stats.verifiedEmployers, label: 'Verified employers', sub: 'background checked' },
    { value: null, text: stats.whatsapp, label: 'WhatsApp members', sub: 'daily job alerts' },
    { value: stats.placements, label: 'Placements', sub: 'and counting' },
  ];

  return (
    <div ref={ref} style={s.strip}>
      {cells.map((c) => (
        <Cell key={c.label} stat={c} run={run} />
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  strip: { display: 'flex', flexWrap: 'wrap', background: '#fff', borderTop: '1px solid #E8E6DF', borderBottom: '1px solid #E8E6DF' },
  cell: { flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: 4, padding: '32px var(--space-2)', borderLeft: '1px solid #f4f3ee' },
  value: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 40, lineHeight: 1, color: '#3A9EA5' },
  underline: { width: 28, height: 3, background: '#F5C842', borderRadius: 2, margin: '2px 0' },
  label: { fontSize: 12, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 },
  sub: { fontSize: 12, color: '#B0AD9F' },
};
