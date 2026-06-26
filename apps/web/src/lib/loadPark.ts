import 'server-only';
import { cache } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';
import { getServerTrpc } from '@/lib/trpc/server';

type Park = inferRouterOutputs<AppRouter>['itParks']['getBySlug'];
type Jobs = inferRouterOutputs<AppRouter>['itParks']['jobs'];

export const loadPark = cache(
  async (slug: string): Promise<{ park: Park | null; jobs: Jobs }> => {
    const trpc = await getServerTrpc();
    const [park, jobs] = await Promise.all([
      trpc.itParks.getBySlug({ slug }).catch(() => null),
      trpc.itParks.jobs({ slug, limit: 20 }).catch(() => ({ items: [], nextCursor: null }) as Jobs),
    ]);
    return { park, jobs };
  },
);
