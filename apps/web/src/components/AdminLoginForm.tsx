'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { trpc } from '@/lib/trpc/client';
import { Logo } from '@/components/Logo';

export function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const login = trpc.auth.adminLogin.useMutation();

  async function submit() {
    setErr('');
    try {
      const res = await login.mutateAsync({ username: username.trim(), password });
      const signed = await signIn('otp', { phone: res.phone, redirect: false });
      if (signed?.error) {
        setErr('Sign-in failed. Try again.');
        return;
      }
      router.push(res.redirectTo);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invalid username or password');
    }
  }

  const busy = login.isPending;

  return (
    <main style={s.main}>
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Logo variant="white" size="lg" href="/" /></div>
        <span style={s.pill}>Admin Panel</span>
        <h1 style={s.title}>Admin Sign In</h1>
        <p style={s.subtitle}>Ddotsmedia Technologies</p>

        <label style={s.label} htmlFor="u">Username</label>
        <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="Enter admin username" style={s.input} />

        <label style={s.label} htmlFor="p">Password</label>
        <div style={s.pwWrap}>
          <input id="p" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} autoComplete="current-password" placeholder="Enter password" style={{ ...s.input, paddingRight: 44 }} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label="Toggle password" style={s.eye}>{show ? '🙈' : '👁'}</button>
        </div>

        {err && <p style={s.err}>{err}</p>}

        <button type="button" onClick={() => void submit()} disabled={busy || !username || !password} style={{ ...s.btn, opacity: busy || !username || !password ? 0.6 : 1 }}>
          {busy ? 'Signing in…' : 'Sign in to Admin Panel'}
        </button>

        <Link href="/" style={s.back}>← Back to ddotsjobs.com</Link>
        <p style={s.notice}>This area is restricted to authorized administrators only. All login attempts are logged.</p>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2)' },
  card: { width: '100%', maxWidth: 420, background: '#1A2B2D', borderRadius: 20, padding: 40, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 },
  pill: { alignSelf: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#fff', background: '#c0392b', padding: '2px 10px', borderRadius: 999, marginTop: 6 },
  title: { color: '#fff', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, margin: '6px 0 0', textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0, textAlign: 'center' },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 10 },
  input: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', padding: '12px 16px', fontSize: 15, width: '100%', outline: 'none' },
  pwWrap: { position: 'relative' },
  eye: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 },
  err: { color: '#E8623A', fontSize: 13, margin: '8px 0 0' },
  btn: { marginTop: 16, width: '100%', background: '#F5C842', color: '#0F1A1B', border: 'none', borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  back: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginTop: 14 },
  notice: { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 1.5 },
};
