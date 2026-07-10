'use client';

import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc/client';

// Fire-and-forget employer-profile view tracker. Runs once per mount; failure
// is ignored. Mirrors IncrementView for job pages.
export function TrackProfileView({ slug }: { slug: string }) {
  const fired = useRef(false);
  const mutate = trpc.jobs.trackProfileView.useMutation();

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    mutate.mutate({ slug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return null;
}
