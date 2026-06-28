import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About — ddotsjobs.com',
  description: "Kerala's most trusted job platform, built by Ddotsmedia IT Solutions, Sharjah UAE — serving 120K+ professionals since 2019.",
};

const STATS = [
  { n: '120K+', l: 'WhatsApp members' },
  { n: '73', l: 'active job groups' },
  { n: '14', l: 'districts covered' },
  { n: '2019', l: 'serving Kerala since' },
];

export default function AboutPage() {
  return (
    <main style={s.main}>
      <div style={s.container}>
        <p style={s.kicker}>About us</p>
        <h1 style={s.h1}>Kerala&rsquo;s most trusted job platform</h1>
        <p style={s.lead}>
          ddotsjobs connects Kerala&rsquo;s workforce with verified employers — salary shown upfront,
          no middlemen, no fake listings.
        </p>

        <div style={s.statRow}>
          {STATS.map((x) => (
            <div key={x.l} style={s.stat}>
              <span style={s.statN}>{x.n}</span>
              <span style={s.statL}>{x.l}</span>
            </div>
          ))}
        </div>

        <h2 style={s.h2}>Our story</h2>
        <p style={s.p}>
          Started by Ddotsmedia in 2019 to connect Kerala&rsquo;s workforce with verified employers.
          What began as a handful of WhatsApp groups has grown into a network serving 120K+
          professionals — nurses, teachers, IT engineers, and gulf returnees — across 73 active
          groups and all 14 districts.
        </p>

        <h2 style={s.h2}>Mission</h2>
        <p style={s.p}>
          Every Keralite deserves a fair shot at honest work — with the salary, location, and employer
          known upfront.
        </p>
        <p style={s.pMl}>
          ഓരോ മലയാളിക്കും സത്യസന്ധമായ ജോലി ലഭിക്കണം — ശമ്പളവും സ്ഥലവും തൊഴിലുടമയും
          മുൻകൂട്ടി അറിഞ്ഞുകൊണ്ട്.
        </p>

        <h2 style={s.h2}>Who builds it</h2>
        <p style={s.p}>
          ddotsjobs is built and operated by <strong>Ddotsmedia IT Solutions LLC</strong>,
          SHAMS Free Zone, Sharjah, UAE. Questions? WhatsApp{' '}
          <a href="https://wa.me/971509379212" style={s.link}>+971 50 937 9212</a> or email{' '}
          <a href="mailto:info@ddotsmedia.com" style={s.link}>info@ddotsmedia.com</a>.
        </p>

        <Link href="/jobs" style={s.cta}>Browse jobs →</Link>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { background: 'var(--color-neutral)', minHeight: '100dvh' },
  container: { width: '100%', maxWidth: 760, margin: '0 auto', padding: 'var(--space-4) var(--space-2) var(--space-5)' },
  kicker: { fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3A9EA5', margin: 0 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(2rem,6vw,3rem)', color: '#1A1916', margin: '8px 0 var(--space-2)' },
  lead: { fontSize: '1.15rem', color: '#6B6860', lineHeight: 1.5, margin: '0 0 var(--space-3)' },
  statRow: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', padding: 'var(--space-2) 0', borderTop: '1px solid #E8E6DF', borderBottom: '1px solid #E8E6DF', margin: '0 0 var(--space-3)' },
  stat: { flex: '1 1 120px', display: 'flex', flexDirection: 'column' },
  statN: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, color: '#3A9EA5', lineHeight: 1 },
  statL: { fontSize: 12, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 },
  h2: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.6rem', color: '#1A1916', margin: 'var(--space-3) 0 8px' },
  p: { fontSize: 15, color: '#33332f', lineHeight: 1.6, margin: 0 },
  pMl: { fontSize: 15, color: '#55554f', lineHeight: 1.7, margin: '8px 0 0' },
  link: { color: '#3A9EA5', fontWeight: 600 },
  cta: { display: 'inline-block', marginTop: 'var(--space-3)', padding: '12px 28px', fontWeight: 700, color: '#fff', background: '#3A9EA5', borderRadius: 'var(--radius-pill)' },
};
