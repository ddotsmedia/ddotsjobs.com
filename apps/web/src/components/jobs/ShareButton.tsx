'use client';

import { useState } from 'react';

// Copy current page link to clipboard (with WhatsApp/native share fallback).
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={onShare} style={s.btn}>
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 44,
    fontSize: 15,
    fontWeight: 600,
    color: '#6b6b66',
    background: '#fff',
    border: '1px solid #e2e2dc',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
};
