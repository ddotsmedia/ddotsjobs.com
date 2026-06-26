import { publicProcedure, router } from '../trpc.js';
import { authRouter } from './auth.js';
import { jobsRouter } from './jobs.js';

// Root tRPC router. Feature routers merge here.
export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const, service: 'ddotsjobs-web' })),
  auth: authRouter,
  jobs: jobsRouter,
});

export type AppRouter = typeof appRouter;
