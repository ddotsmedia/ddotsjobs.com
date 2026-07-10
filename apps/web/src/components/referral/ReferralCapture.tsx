'use client';

import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc/client';

// Counts a click when a job page is opened via a ?ref=CODE referral link.
// Client-only + best-effort, so the job page stays ISR-cached.
export function ReferralCapture() {
  const track = trpc.referral.trackClick.useMutation();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!ref) return;
    fired.current = true;
    track.mutate({ referralCode: ref });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
