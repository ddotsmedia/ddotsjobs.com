import { publicProcedure, router } from '../trpc.js';
import { authRouter } from './auth.js';

// Root tRPC router. Feature routers merge here.
export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const, service: 'ddotsjobs-web' })),
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
