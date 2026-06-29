'use client';

import { useEffect, useState } from 'react';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';

const WA = '971509379212';
const waLink = (text: string) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;

const QUICK = [
  { label: '🔍 Find jobs', text: "Hi, I'm looking for jobs in Kerala. Please help me find relevant openings." },
  { label: '📋 Post a job', text: 'Hi, I want to post a job on ddotsjobs.com. Please guide me through the process.' },
  { label: '🔔 WhatsApp alerts', text: 'Hi, I want to receive job alerts on WhatsApp. Please add me to the relevant job groups.' },
  { label: '📞 Talk to team', text: 'Hi, I need to speak with the ddotsjobs team. When can we connect?' },
];

export function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const [typing, setTyping] = useState(false);
  const [showMsg2, setShowMsg2] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!open || showMsg2) return;
    setTyping(true);
    const t1 = setTimeout(() => {
      setTyping(false);
      setShowMsg2(true);
    }, 1000);
    return () => clearTimeout(t1);
  }, [open, showMsg2]);

  function toggle() {
    setOpen((v) => !v);
    setUnread(false);
  }
  function send() {
    window.open(waLink(draft || 'Hi, I need help with ddotsjobs.com'), '_blank', 'noopener');
  }

  return (
    <>
      {/* Popup */}
      <div
        style={{
          ...s.popup,
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          pointerEvents: open ? 'auto' : 'none',
        }}
        role="dialog"
        aria-hidden={!open}
      >
        <div style={s.header}>
          <div style={s.avatar} aria-hidden>
            <WhatsAppIcon size={24} fill="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={s.hName}>ddotsjobs Support</p>
            <p style={s.hStatus}><span style={s.greenDot} aria-hidden /> Online · Typically replies instantly</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={s.close}>×</button>
        </div>

        <div style={s.body}>
          <div style={s.bubble}>
            👋 നമസ്കാരം! ddotsjobs-ലേക്ക് സ്വാഗതം
            <span style={s.time}>now</span>
          </div>
          {typing && (
            <div style={s.typingBubble}>
              <span className="wa-typing"><span /><span /><span /></span>
            </div>
          )}
          {showMsg2 && (
            <div style={s.bubble}>
              Kerala-ലെ ഏറ്റവും നല്ല verified jobs ഇവിടെ കാണാം. എനിക്ക് നിങ്ങളെ help ചെയ്യാം 😊
              <span style={s.time}>now</span>
            </div>
          )}
        </div>

        <div style={s.quickRow}>
          {QUICK.map((q) => (
            <a key={q.label} href={waLink(q.text)} target="_blank" rel="noopener noreferrer" style={s.quickChip}>{q.label}</a>
          ))}
        </div>

        <div style={s.inputRow}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Type a message..."
            aria-label="Message"
            style={s.input}
          />
          <button type="button" onClick={send} aria-label="Send on WhatsApp" style={s.sendBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
          </button>
        </div>
      </div>

      {/* Floating button */}
      <button type="button" onClick={toggle} aria-label="Chat on WhatsApp" style={s.fab} className="wa-pulse-ring">
        <WhatsAppIcon size={32} fill="#fff" />
        {unread && <span style={s.badge}>1</span>}
      </button>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  fab: { position: 'fixed', bottom: 24, right: 24, zIndex: 999, width: 60, height: 60, borderRadius: '50%', background: '#25D366', border: 'none', boxShadow: '0 4px 20px rgba(37,211,102,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, width: 20, height: 20, background: '#E8623A', borderRadius: '50%', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  popup: { position: 'fixed', bottom: 96, right: 24, width: 320, maxWidth: 'calc(100vw - 32px)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', zIndex: 998, background: '#fff', transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)' },
  header: { position: 'relative', background: '#075E54', padding: 16, display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' },
  hName: { color: '#fff', fontWeight: 600, fontSize: 15, margin: 0 },
  hStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 5 },
  greenDot: { width: 6, height: 6, borderRadius: '50%', background: '#8DC63F', display: 'inline-block' },
  close: { position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.7)', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' },
  body: { background: '#ECE5DD', padding: 16, minHeight: 180, display: 'flex', flexDirection: 'column', gap: 8 },
  bubble: { background: '#fff', borderRadius: '0 12px 12px 12px', padding: '10px 14px', maxWidth: '85%', fontSize: 14, color: '#1A1916', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', lineHeight: 1.45 },
  time: { display: 'block', fontSize: 10, color: '#999', textAlign: 'right', marginTop: 2 },
  typingBubble: { background: '#fff', borderRadius: '0 12px 12px 12px', padding: '12px 16px', width: 'fit-content', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
  quickRow: { background: '#fff', padding: '8px 12px', borderTop: '1px solid #F0F0F0', display: 'flex', flexWrap: 'wrap', gap: 6 },
  quickChip: { border: '1.5px solid #3A9EA5', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#3A9EA5', fontWeight: 500, background: '#fff' },
  inputRow: { background: '#F0F0F0', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' },
  input: { flex: 1, minWidth: 0, background: '#fff', borderRadius: 20, padding: '8px 14px', fontSize: 13, border: 'none', outline: 'none' },
  sendBtn: { width: 36, height: 36, borderRadius: '50%', background: '#25D366', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: '0 0 auto' },
};
