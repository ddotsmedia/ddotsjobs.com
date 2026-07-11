import { publicProcedure, router } from '../trpc.js';
import { accountRouter } from './account.js';
import { adminRouter } from './admin.js';
import { alertsRouter } from './alerts.js';
import { billingRouter } from './billing.js';
import { applicationsRouter } from './applications.js';
import { apiKeysRouter } from './api-keys.js';
import { atsRouter } from './ats.js';
import { chatRouter } from './chat.js';
import { companyRouter } from './company.js';
import { authRouter } from './auth.js';
import { employerRouter } from './employer.js';
import { employerDashboardRouter } from './employer-dashboard.js';
import { endorsementRouter } from './endorsement.js';
import { fitScoreRouter } from './fit-score.js';
import { itParksRouter } from './it-parks.js';
import { jobsRouter } from './jobs.js';
import { notificationsRouter } from './notifications.js';
import { pravasiRouter } from './pravasi.js';
import { referralRouter } from './referral.js';
import { pscRouter } from './psc.js';
import { postRouter } from './post.js';
import { assessmentRouter } from './assessment.js';
import { interviewRouter } from './interview.js';
import { resumeRouter } from './resume.js';
import { reviewsRouter } from './reviews.js';
import { screeningRouter } from './screening.js';
import { seekerRouter } from './seeker.js';
import { seekerDashboardRouter } from './seeker-dashboard.js';
import { talentPoolRouter } from './talent-pool.js';
import { tenantRouter } from './tenant.js';
import { verificationRouter } from './verification.js';
import { walkinRouter } from './walkin.js';

// Root tRPC router. Feature routers merge here.
export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const, service: 'ddotsjobs-web' })),
  account: accountRouter,
  admin: adminRouter,
  alerts: alertsRouter,
  billing: billingRouter,
  applications: applicationsRouter,
  apiKeys: apiKeysRouter,
  ats: atsRouter,
  chat: chatRouter,
  company: companyRouter,
  auth: authRouter,
  employer: employerRouter,
  employerDashboard: employerDashboardRouter,
  endorsement: endorsementRouter,
  fitScore: fitScoreRouter,
  itParks: itParksRouter,
  jobs: jobsRouter,
  notifications: notificationsRouter,
  pravasi: pravasiRouter,
  referral: referralRouter,
  interview: interviewRouter,
  psc: pscRouter,
  post: postRouter,
  assessment: assessmentRouter,
  resume: resumeRouter,
  reviews: reviewsRouter,
  screening: screeningRouter,
  seeker: seekerRouter,
  seekerDashboard: seekerDashboardRouter,
  talentPool: talentPoolRouter,
  tenant: tenantRouter,
  verification: verificationRouter,
  walkin: walkinRouter,
});

export type AppRouter = typeof appRouter;
