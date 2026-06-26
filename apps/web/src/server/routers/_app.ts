import { publicProcedure, router } from '../trpc.js';
import { authRouter } from './auth.js';
import { jobsRouter } from './jobs.js';
import { pscRouter } from './psc.js';

// Root tRPC router. Feature routers merge here.
export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const, service: 'ddotsjobs-web' })),
  auth: authRouter,
  jobs: jobsRouter,
  psc: pscRouter,
});

export type AppRouter = typeof appRouter;
