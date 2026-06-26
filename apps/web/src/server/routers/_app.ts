import { publicProcedure, router } from '../trpc.js';
import { alertsRouter } from './alerts.js';
import { applicationsRouter } from './applications.js';
import { authRouter } from './auth.js';
import { fitScoreRouter } from './fit-score.js';
import { itParksRouter } from './it-parks.js';
import { jobsRouter } from './jobs.js';
import { pravasiRouter } from './pravasi.js';
import { pscRouter } from './psc.js';
import { seekerRouter } from './seeker.js';
import { verificationRouter } from './verification.js';

// Root tRPC router. Feature routers merge here.
export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const, service: 'ddotsjobs-web' })),
  alerts: alertsRouter,
  applications: applicationsRouter,
  auth: authRouter,
  fitScore: fitScoreRouter,
  itParks: itParksRouter,
  jobs: jobsRouter,
  pravasi: pravasiRouter,
  psc: pscRouter,
  seeker: seekerRouter,
  verification: verificationRouter,
});

export type AppRouter = typeof appRouter;
