// Subscription plans — source of truth in config, NOT the DB.
// Prices in paise (integer). Display = paise ÷ 100.
export const PLANS = {
  free: {
    name: 'Free',
    pricePaise: 0,
    jobsPerPeriod: 3,
    talentPoolAccess: false,
    knmcFilterAccess: false,
    whatsappPushPerMonth: 0,
    walkInNoticesPerMonth: 1,
    razorpayPlanId: undefined as string | undefined,
  },
  employer_starter: {
    name: 'Starter',
    pricePaise: 99900,
    jobsPerPeriod: 5,
    talentPoolAccess: false,
    knmcFilterAccess: false,
    whatsappPushPerMonth: 50,
    walkInNoticesPerMonth: 3,
    razorpayPlanId: process.env.RAZORPAY_PLAN_STARTER,
  },
  employer_growth: {
    name: 'Growth',
    pricePaise: 299900,
    jobsPerPeriod: 15,
    talentPoolAccess: true,
    knmcFilterAccess: false,
    whatsappPushPerMonth: 200,
    walkInNoticesPerMonth: 10,
    razorpayPlanId: process.env.RAZORPAY_PLAN_GROWTH,
  },
  hospital_pro: {
    name: 'Hospital Pro',
    pricePaise: 699900,
    jobsPerPeriod: 999,
    talentPoolAccess: true,
    knmcFilterAccess: true,
    whatsappPushPerMonth: 500,
    walkInNoticesPerMonth: 999,
    razorpayPlanId: process.env.RAZORPAY_PLAN_HOSPITAL,
  },
  agency: {
    name: 'Agency',
    pricePaise: 999900,
    jobsPerPeriod: 999,
    talentPoolAccess: true,
    knmcFilterAccess: true,
    whatsappPushPerMonth: 1000,
    walkInNoticesPerMonth: 999,
    razorpayPlanId: process.env.RAZORPAY_PLAN_AGENCY,
  },
} as const;

export type PlanTier = keyof typeof PLANS;
export type PaidTier = Exclude<PlanTier, 'free'>;
export const PAID_TIERS: readonly PaidTier[] = ['employer_starter', 'employer_growth', 'hospital_pro', 'agency'];
export const RECOMMENDED_TIER: PaidTier = 'hospital_pro';

export type PublicPlan = Omit<(typeof PLANS)[PlanTier], 'razorpayPlanId'> & { tier: PlanTier };

/** Plans for the client — strips razorpayPlanId. */
export function publicPlans(): PublicPlan[] {
  return (Object.keys(PLANS) as PlanTier[]).map((tier) => {
    const { razorpayPlanId: _omit, ...rest } = PLANS[tier];
    return { tier, ...rest };
  });
}
