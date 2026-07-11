import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
// Type-only import of the backend router for end-to-end type safety.
// NOTE: for a clean build, extract AppRouter into a shared package
// (e.g. packages/api) and import it from there instead of reaching across
// into apps/web. Runtime is unaffected (this is elided by the bundler).
import type { AppRouter } from '../../../web/src/server/routers/_app';
import { TRPC_URL } from '../config';
import { getToken } from './auth';

export const trpc = createTRPCReact<AppRouter>();

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        transformer: superjson, // must match the server (initTRPC ... superjson)
        async headers() {
          const token = await getToken();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
