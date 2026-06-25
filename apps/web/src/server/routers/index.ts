import { publicProcedure, router } from '../trpc.js';

// Root tRPC router. Feature routers get merged here in subsequent prompts.
export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const, service: 'ddotsjobs-web' })),
});

export type AppRouter = typeof appRouter;
