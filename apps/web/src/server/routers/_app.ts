import { publicProcedure, router } from '../trpc.js';
import { authRouter } from './auth.js';
import { itParksRouter } from './it-parks.js';
import { jobsRouter } from './jobs.js';
import { pravasiRouter } from './pravasi.js';
import { pscRouter } from './psc.js';
import { seekerRouter } from './seeker.js';

// Root tRPC router. Feature routers merge here.
export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const, service: 'ddotsjobs-web' })),
  auth: authRouter,
  itParks: itParksRouter,
  jobs: jobsRouter,
  pravasi: pravasiRouter,
  psc: pscRouter,
  seeker: seekerRouter,
});

export type AppRouter = typeof appRouter;
