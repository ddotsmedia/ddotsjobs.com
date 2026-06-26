'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Logo } from '@/components/Logo';

// E.164 international: + then 8–15 digits, leading digit non-zero.
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+91');
  const requestOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: () => router.push(`/verify?phone=${encodeURIComponent(phone)}`),
  });

  const valid = PHONE_RE.test(phone);

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <Logo variant="full" size={36} />
        </div>
        <p style={styles.sub}>കേരളത്തിന്റെ തൊഴിൽ പോർട്ടൽ</p>

        <label htmlFor="phone" style={styles.label}>
          Mobile number
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\s/g, ''))}
          placeholder="+91XXXXXXXXXX or +971XXXXXXXXX"
          style={styles.input}
        />
        {phone.length > 3 && !valid && (
          <span style={styles.err}>Enter a valid mobile number with country code</span>
        )}
        {requestOtp.error && <span style={styles.err}>{requestOtp.error.message}</span>}

        <button
          type="button"
          disabled={!valid || requestOtp.isPending}
          onClick={() => requestOtp.mutate({ phone })}
          style={{ ...styles.btn, opacity: !valid || requestOtp.isPending ? 0.55 : 1 }}
        >
          {requestOtp.isPending ? 'Sending…' : 'Send OTP'}
        </button>
      </div>
    </main>
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
    fontSize: 16,
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
};
