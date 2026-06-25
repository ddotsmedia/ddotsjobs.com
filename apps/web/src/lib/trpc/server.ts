import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { appRouter } from '@/server/routers/index';
import { createContext } from '@/server/trpc';

// Server-side tRPC caller for React Server Components.
export const getServerTrpc = cache(async () => {
  const h = new Headers(await headers());
  const ctx = await createContext({ headers: h });
  return appRouter.createCaller(ctx);
});
