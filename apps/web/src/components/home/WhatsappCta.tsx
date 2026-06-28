'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Full-width dark-teal WhatsApp join section.
export function WhatsappCta() {
  const router = useRouter();
  const [phone, setPhone] = useState('+91');

  function join() {
    const p = phone.trim();
    router.push(`/seeker/alerts${/^\+[1-9]\d{7,14}$/.test(p) ? `?phone=${encodeURIComponent(p)}` : ''}`);
  }

  return (
    <section style={s.section}>
      <div style={s.inner}>
        <p style={s.title}>Join 120K+ professionals on WhatsApp</p>
        <p style={s.sub}>Get Kerala jobs delivered to your phone daily.</p>
        <div style={s.form}>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\s/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            placeholder="+91XXXXXXXXXX"
            aria-label="WhatsApp number"
            style={s.input}
          />
          <button type="button" onClick={join} style={s.btn}>Join Now</button>
        </div>
        <p style={s.note}>💬 76 active job groups</p>
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  section: { background: 'linear-gradient(135deg, #1F6B70 0%, #3A9EA5 100%)' },
  inner: { width: '100%', maxWidth: 1040, margin: '0 auto', padding: 'clamp(40px,7vw,72px) var(--space-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 },
  title: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.6rem,4vw,2.4rem)', color: '#fff', margin: 0 },
  sub: { fontSize: 'clamp(0.95rem,2.5vw,1.1rem)', color: 'rgba(255,255,255,0.85)', margin: 0 },
  form: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 'var(--space-2)', width: '100%', maxWidth: 460 },
  input: { flex: '1 1 220px', minWidth: 0, height: 52, padding: '0 18px', fontSize: 16, border: 'none', borderRadius: 50, outline: 'none', color: '#1A1916' },
  btn: { height: 52, padding: '0 28px', fontSize: 16, fontWeight: 700, color: '#1A1916', background: '#F5C842', border: 'none', borderRadius: 50, cursor: 'pointer', whiteSpace: 'nowrap' },
  note: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 8 },
};
