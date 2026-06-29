import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — ddotsjobs.com',
  description: 'How ddotsjobs collects, uses and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main style={s.main}>
      <div style={s.container}>
        <h1 style={s.h1}>Privacy Policy</h1>
        <p style={s.updated}>Last updated: June 2026</p>

        <h2 style={s.h2}>What we collect</h2>
        <p style={s.p}>
          Your phone number (for sign-in via OTP), and the profile details you choose to add —
          name, district, experience, skills, preferred categories, and any resume or credential
          documents you upload. Employers provide company details and job posts.
        </p>

        <h2 style={s.h2}>How we use it</h2>
        <p style={s.p}>
          To match you with relevant jobs, send the job alerts you opt into (WhatsApp / SMS / email),
          show your profile to verified employers in the talent pool (only if your visibility is not
          set to private), and operate and improve the platform.
        </p>

        <h2 style={s.h2}>We never sell your data</h2>
        <p style={s.p}>
          We do not sell or rent your personal information to third parties. Your phone number is
          never shown publicly — employers contact you only through ddotsjobs.
        </p>

        <h2 style={s.h2}>Your rights</h2>
        <p style={s.p}>
          You can view, edit, or delete your profile at any time. To request full account and data
          deletion, WhatsApp <a href="https://wa.me/971509379212" style={s.link}>+971 50 937 9212</a>{' '}
          or email <a href="mailto:info@ddotsmedia.com" style={s.link}>info@ddotsmedia.com</a>.
          We honour data-access and erasure requests in line with applicable data-protection law
          (including GDPR principles).
        </p>

        <h2 style={s.h2}>Contact</h2>
        <p style={s.p}>
          Ddotsmedia Technologies.<br />
          WhatsApp: +971 50 937 9212 · Email: info@ddotsmedia.com
        </p>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { background: 'var(--color-neutral)', minHeight: '100dvh' },
  container: { width: '100%', maxWidth: 720, margin: '0 auto', padding: 'var(--space-4) var(--space-2) var(--space-5)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(2rem,6vw,2.8rem)', color: '#1A1916', margin: 0 },
  updated: { fontSize: 13, color: '#B0AD9F', margin: '6px 0 var(--space-3)' },
  h2: { fontSize: '1.2rem', fontWeight: 700, color: '#1A1916', margin: 'var(--space-3) 0 6px' },
  p: { fontSize: 15, color: '#33332f', lineHeight: 1.6, margin: 0 },
  link: { color: '#3A9EA5', fontWeight: 600 },
};
