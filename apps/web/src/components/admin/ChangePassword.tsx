'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

export function ChangePassword() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const change = trpc.auth.changeAdminPassword.useMutation({
    onSuccess: () => { setMsg('Password updated.'); setCur(''); setNext(''); setConfirm(''); },
    onError: (e) => setMsg(e.message),
  });

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = cur.length > 0 && next.length >= 12 && next === confirm && !change.isPending;

  return (
    <main style={s.main}>
      <div style={s.card}>
        <h1 style={s.h1}>Admin settings</h1>
        <p style={s.sub}>Change your admin password</p>

        <label style={s.label}>Current password</label>
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" style={s.input} />

        <label style={s.label}>New password (min 12 chars)</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" style={s.input} />

        <label style={s.label}>Confirm new password</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" style={s.input} />
        {mismatch && <p style={s.err}>Passwords do not match.</p>}
        {msg && <p style={msg === 'Password updated.' ? s.ok : s.err}>{msg}</p>}

        <button type="button" onClick={() => change.mutate({ currentPassword: cur, newPassword: next })} disabled={!canSubmit} style={{ ...s.btn, opacity: canSubmit ? 1 : 0.6 }}>
          {change.isPending ? 'Saving…' : 'Update password'}
        </button>
        <Link href="/admin/dashboard" style={s.back}>← Back to dashboard</Link>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2)' },
  card: { width: '100%', maxWidth: 420, background: '#1A2B2D', borderRadius: 20, padding: 40, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 },
  h1: { color: '#fff', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, margin: 0 },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 10px' },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 },
  input: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', padding: '12px 16px', fontSize: 15, width: '100%', outline: 'none' },
  err: { color: '#E8623A', fontSize: 13, margin: '6px 0 0' },
  ok: { color: '#8DC63F', fontSize: 13, margin: '6px 0 0' },
  btn: { marginTop: 16, width: '100%', background: '#F5C842', color: '#0F1A1B', border: 'none', borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  back: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginTop: 12 },
};
