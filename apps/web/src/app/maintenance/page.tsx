import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = { title: 'Maintenance — ddotsjobs.com', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function MaintenancePage() {
  return (
    <main style={s.main}>
      <div style={s.card}>
        <Logo size="lg" variant="white" href={undefined} />
        <h1 style={s.h1}>We&rsquo;ll be back soon</h1>
        <p style={s.ml}>ഞങ്ങൾ ഉടൻ തിരിച്ചു വരും</p>
        <p style={s.sub}>ddotsjobs is undergoing scheduled maintenance. Please check back shortly.</p>
        <a href="https://wa.me/971509379212" style={s.wa}>WhatsApp us →</a>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2)' },
  card: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 420 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.8rem,6vw,2.6rem)', color: '#fff', margin: '12px 0 0' },
  ml: { color: '#F5C842', fontSize: 16, margin: 0 },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: '8px 0 0' },
  wa: { marginTop: 12, color: '#0F1A1B', background: '#8DC63F', padding: '12px 22px', borderRadius: 999, fontWeight: 700, fontSize: 14 },
};
