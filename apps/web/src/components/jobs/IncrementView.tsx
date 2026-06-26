'use client';

import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc/client';

// Fire-and-forget view counter. Runs once per mount; failure is ignored.
export function IncrementView({ jobId }: { jobId: string }) {
  const fired = useRef(false);
  const mutate = trpc.jobs.incrementView.useMutation();

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    mutate.mutate({ id: jobId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return null;
}
