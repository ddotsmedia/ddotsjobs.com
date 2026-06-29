import { WhatsAppIcon } from '@/components/WhatsAppIcon';

// Slim dark announcement / contact bar above the public navbar.
export function ContactBar() {
  return (
    <div style={s.bar}>
      <span style={s.left}>
        <span className="ddj-live-dot" style={s.dot} aria-hidden />
        <span style={s.live}>Live</span>
        <span className="ddj-desktop-only" style={s.liveFull}>&nbsp;— 12 employers posting today</span>
      </span>

      <span className="ddj-desktop-only" style={s.center}>📍 Managed by Ddotsmedia IT Solutions, Sharjah UAE</span>

      <span style={s.right}>
        <a href="https://wa.me/971509379212" target="_blank" rel="noopener noreferrer" style={s.wa}>
          <WhatsAppIcon size={14} />
          <span>+971 50 937 9212</span>
        </a>
        <span className="ddj-desktop-only" style={s.sep}>·</span>
        <a href="mailto:info@ddotsmedia.com" className="ddj-desktop-only" style={s.email}>info@ddotsmedia.com</a>
      </span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bar: { height: 36, background: '#0F1A1B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 clamp(12px,4vw,32px)', fontSize: 12 },
  left: { display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  dot: { width: 6, height: 6, background: '#8DC63F', borderRadius: '50%', display: 'inline-block' },
  live: { fontWeight: 600, color: 'rgba(255,255,255,0.85)' },
  liveFull: { color: 'rgba(255,255,255,0.6)' },
  center: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  right: { display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' },
  wa: { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#25D366', fontWeight: 600, fontSize: 12 },
  sep: { color: 'rgba(255,255,255,0.3)' },
  email: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
};
