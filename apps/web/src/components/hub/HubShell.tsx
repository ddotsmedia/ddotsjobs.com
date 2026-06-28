import type { ReactNode } from 'react';
import Link from 'next/link';

// Shared layout for Kerala sector/resource hub landing pages.
export function Hub({
  kicker,
  title,
  titleMl,
  sub,
  children,
}: {
  kicker: string;
  title: string;
  titleMl: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <main style={s.main}>
      <section style={s.hero}>
        <div style={s.container}>
          <p style={s.kicker}>{kicker}</p>
          <h1 style={s.h1}>{title}</h1>
          <p style={s.titleMl}>{titleMl}</p>
          <p style={s.sub}>{sub}</p>
        </div>
      </section>
      <div style={{ ...s.container, ...s.body }}>{children}</div>
    </main>
  );
}

export function HubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={s.section}>
      <h2 style={s.h2}>{title}</h2>
      {children}
    </section>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div style={s.cards}>{children}</div>;
}

export function Card({ title, children, href }: { title: string; children?: ReactNode; href?: string }) {
  const inner = (
    <>
      <p style={s.cardTitle}>{title}</p>
      {children && <div style={s.cardBody}>{children}</div>}
    </>
  );
  if (href) {
    const external = href.startsWith('http');
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" style={s.card}>{inner}</a>
    ) : (
      <Link href={href} style={s.card}>{inner}</Link>
    );
  }
  return <div style={s.card}>{inner}</div>;
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={s.bullets}>
      {items.map((b, i) => <li key={i} style={s.bullet}>{b}</li>)}
    </ul>
  );
}

export function SalaryTable({ rows }: { rows: [string, string][] }) {
  return (
    <div style={s.tableWrap}>
      {rows.map(([role, pay], i) => (
        <div key={i} style={s.trow}>
          <span style={s.role}>{role}</span>
          <span style={s.pay}>{pay}</span>
        </div>
      ))}
    </div>
  );
}

export function CtaLink({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http');
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={s.cta}>{children}</a>
  ) : (
    <Link href={href} style={s.cta}>{children}</Link>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { background: 'var(--color-neutral)', minHeight: '100dvh' },
  container: { width: '100%', maxWidth: 900, margin: '0 auto', padding: '0 var(--space-2)' },
  hero: { padding: 'clamp(40px,7vw,72px) 0', background: 'linear-gradient(160deg, #F0F9FA 0%, #FFFFFF 55%, #F8FDF0 100%)' },
  kicker: { fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3A9EA5', borderLeft: '2px solid #F5C842', paddingLeft: 10, margin: 0 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(2rem,6vw,3rem)', letterSpacing: '-0.02em', color: '#1A1916', margin: '10px 0 4px' },
  titleMl: { fontSize: '1.1rem', color: '#3A9EA5', margin: 0 },
  sub: { fontSize: 'clamp(1rem,3vw,1.15rem)', color: '#6B6860', margin: '10px 0 0', maxWidth: 560 },
  body: { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-2) var(--space-5)' },
  section: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.5rem,4vw,2rem)', color: '#1A1916', margin: 0 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 'var(--space-2)' },
  card: { display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#1A1916', margin: 0 },
  cardBody: { fontSize: 13, color: '#55554f', lineHeight: 1.5 },
  bullets: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 },
  bullet: { fontSize: 15, color: '#33332f', lineHeight: 1.5 },
  tableWrap: { display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', overflow: 'hidden' },
  trow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px var(--space-2)', borderBottom: '1px solid #f4f3ee' },
  role: { fontSize: 14, color: '#1A1916' },
  pay: { fontSize: 14, fontWeight: 700, color: '#3A9EA5', whiteSpace: 'nowrap' },
  cta: { alignSelf: 'flex-start', padding: '12px 24px', fontWeight: 700, color: '#1A1916', background: '#F5C842', borderRadius: 'var(--radius-pill)' },
};
