import { publicProcedure, router } from '../trpc.js';
import { adminRouter } from './admin.js';
import { alertsRouter } from './alerts.js';
import { billingRouter } from './billing.js';
import { applicationsRouter } from './applications.js';
import { authRouter } from './auth.js';
import { employerRouter } from './employer.js';
import { employerDashboardRouter } from './employer-dashboard.js';
import { fitScoreRouter } from './fit-score.js';
import { itParksRouter } from './it-parks.js';
import { jobsRouter } from './jobs.js';
import { notificationsRouter } from './notifications.js';
import { pravasiRouter } from './pravasi.js';
import { pscRouter } from './psc.js';
import { interviewRouter } from './interview.js';
import { resumeRouter } from './resume.js';
import { reviewsRouter } from './reviews.js';
import { seekerRouter } from './seeker.js';
import { seekerDashboardRouter } from './seeker-dashboard.js';
import { talentPoolRouter } from './talent-pool.js';
import { verificationRouter } from './verification.js';
import { walkinRouter } from './walkin.js';

// Root tRPC router. Feature routers merge here.
export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const, service: 'ddotsjobs-web' })),
  admin: adminRouter,
  alerts: alertsRouter,
  billing: billingRouter,
  applications: applicationsRouter,
  auth: authRouter,
  employer: employerRouter,
  employerDashboard: employerDashboardRouter,
  fitScore: fitScoreRouter,
  itParks: itParksRouter,
  jobs: jobsRouter,
  notifications: notificationsRouter,
  pravasi: pravasiRouter,
  interview: interviewRouter,
  psc: pscRouter,
  resume: resumeRouter,
  reviews: reviewsRouter,
  seeker: seekerRouter,
  seekerDashboard: seekerDashboardRouter,
  talentPool: talentPoolRouter,
  verification: verificationRouter,
  walkin: walkinRouter,
});

export type AppRouter = typeof appRouter;
