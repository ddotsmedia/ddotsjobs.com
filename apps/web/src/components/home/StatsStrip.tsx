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

function Cell({ stat, run, accent }: { stat: Stat; run: boolean; accent: string }) {
  const counted = useCountUp(stat.value ?? 0, run);
  const display = stat.value == null ? (stat.text ?? '') : counted.toLocaleString('en-IN');
  return (
    <div style={s.cell}>
      <span style={s.label}>{stat.label}</span>
      <span style={{ ...s.value, color: accent }}>{display}</span>
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
    { value: stats.activeJobs, label: 'Active jobs', sub: 'സജീവ ജോലികൾ · across 14 districts' },
    { value: stats.verifiedEmployers, label: 'Verified employers', sub: 'verified employers · background checked' },
    { value: null, text: stats.whatsapp, label: 'WhatsApp members', sub: 'WhatsApp അംഗങ്ങൾ · daily alerts' },
    { value: stats.placements, label: 'Placements', sub: 'placements · and counting' },
  ];

  return (
    <div ref={ref} style={s.strip}>
      {cells.map((c) => (
        <Cell key={c.label} stat={c} run={run} accent={c.value == null ? '#8DC63F' : '#F5C842'} />
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  strip: { display: 'flex', flexWrap: 'wrap', background: '#0F1A1B', borderRadius: 20, overflow: 'hidden', padding: '8px 0' },
  cell: { flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: 6, padding: '32px var(--space-3)', borderLeft: '1px solid rgba(255,255,255,0.08)' },
  label: { fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' },
  value: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 52, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
};
