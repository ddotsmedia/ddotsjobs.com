'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { trpc } from '@/lib/trpc/client';

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get('phone') ?? '';
  const [otp, setOtp] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: async () => {
      setSigningIn(true);
      setError(null);
      const res = await signIn('otp', { phone, redirect: false });
      if (res?.error) {
        setError('Sign-in failed. Request a new OTP.');
        setSigningIn(false);
        return;
      }
      router.replace('/seeker/dashboard');
    },
    onError: (e) => setError(e.message),
  });

  const valid = /^\d{6}$/.test(otp);
  const busy = verifyOtp.isPending || signingIn;

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.title}>Verify</h1>
        <p style={styles.sub}>
          OTP sent to <strong>{phone || 'your number'}</strong>
        </p>

        <label htmlFor="otp" style={styles.label}>
          6-digit code
        </label>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="••••••"
          style={styles.input}
        />
        {error && <span style={styles.err}>{error}</span>}

        <button
          type="button"
          disabled={!valid || busy || !phone}
          onClick={() => verifyOtp.mutate({ phone, otp })}
          style={{ ...styles.btn, opacity: !valid || busy || !phone ? 0.55 : 1 }}
        >
          {busy ? 'Verifying…' : 'Verify ചെയ്യൂ'}
        </button>

        <button type="button" onClick={() => router.push('/login')} style={styles.link}>
          Change number
        </button>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-2)',
    background: 'var(--color-neutral)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    padding: 'var(--space-3)',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    boxShadow: '0 1px 3px rgba(15,14,12,0.08)',
  },
  title: { fontSize: '2rem', color: 'var(--color-accent)', margin: 0 },
  sub: { fontSize: 14, color: '#6b6b66', marginBottom: 'var(--space-2)' },
  label: { fontSize: 13, fontWeight: 600 },
  input: {
    height: 48,
    padding: '0 14px',
    fontSize: 22,
    letterSpacing: '0.4em',
    textAlign: 'center',
    border: '1px solid #dcdcd6',
    borderRadius: 'var(--radius-input)',
    outline: 'none',
  },
  err: { color: '#c0392b', fontSize: 13 },
  btn: {
    height: 48,
    marginTop: 'var(--space-1)',
    fontSize: 16,
    fontWeight: 600,
    color: '#0f0e0c',
    background: 'var(--color-brand)',
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
  link: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b6b66',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
};
