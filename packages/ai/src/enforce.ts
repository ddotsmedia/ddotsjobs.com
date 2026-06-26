import { redis } from '@ddotsjobs/redis';
import { COST_CEILING, type ModelTier } from '@ddotsjobs/config/models';

// Circuit breaker + budget tracking for all AI traffic.
// All Redis keys are namespaced by @ddotsjobs/redis (ddotsjobs:) automatically.

const BREAKER_KEY = 'ai:breaker:state';
const BREAKER_FAILS_KEY = 'ai:breaker:fails';
const DAILY_SPEND_PREFIX = 'ai:spend:'; // + YYYY-MM-DD

const FAILURE_THRESHOLD = 5; // consecutive failures before opening
const COOLDOWN_SECONDS = 60; // breaker stays open this long
/** Hard daily budget across all AI calls, in paise. ₹2,000/day default. */
const DAILY_BUDGET_PAISE = Number(process.env.AI_DAILY_BUDGET_PAISE ?? 200_000);

export class AIBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIBudgetError';
  }
}

export class AICircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AICircuitOpenError';
  }
}

/** UTC day bucket. Date.now is fine at runtime (only forbidden in workflows). */
function todayKey(): string {
  return DAILY_SPEND_PREFIX + new Date().toISOString().slice(0, 10);
}

/** Throw if breaker is open. Call before dispatching a request. */
export async function assertCircuitClosed(): Promise<void> {
  const [state, active] = await Promise.all([
    redis.get(BREAKER_KEY),
    redis.get('ai:circuit_breaker:active'),
  ]);
  if (state === 'open' || active) {
    throw new AICircuitOpenError('AI circuit breaker is open — cooling down');
  }
}

/** Track daily USD cost + call count for the 9am budget cron. */
export async function trackUsage(usdCost: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await Promise.all([
    redis.incrbyfloat(`ai:cost:${day}`, usdCost).then(() => redis.expire(`ai:cost:${day}`, 60 * 60 * 48)),
    redis.incr(`ai:calls:${day}`).then(() => redis.expire(`ai:calls:${day}`, 60 * 60 * 48)),
  ]);
}

/**
 * Reserve budget for a projected call cost (paise). Throws AIBudgetError if the
 * day's spend would exceed DAILY_BUDGET_PAISE. Also enforces the per-tier
 * COST_CEILING. Returns the day key so the caller can reconcile actuals.
 */
export async function reserveBudget(tier: ModelTier, projectedPaise: number): Promise<string> {
  if (projectedPaise > COST_CEILING[tier]) {
    throw new AIBudgetError(
      `Projected cost ${projectedPaise}p exceeds ${tier} ceiling ${COST_CEILING[tier]}p`,
    );
  }
  const key = todayKey();
  const spent = await redis.incrby(key, projectedPaise);
  // Expire the counter after 48h so old day-buckets clean themselves up.
  await redis.expire(key, 60 * 60 * 48);
  if (spent > DAILY_BUDGET_PAISE) {
    // Roll back the reservation and refuse.
    await redis.decrby(key, projectedPaise);
    throw new AIBudgetError(`Daily AI budget ${DAILY_BUDGET_PAISE}p exhausted`);
  }
  return key;
}

/** Reconcile reserved vs actual cost after a call completes. */
export async function reconcileBudget(
  dayKey: string,
  reservedPaise: number,
  actualPaise: number,
): Promise<void> {
  const delta = actualPaise - reservedPaise;
  if (delta !== 0) await redis.incrby(dayKey, delta);
}

/** Record a successful call — resets the consecutive-failure counter. */
export async function recordSuccess(): Promise<void> {
  await redis.del(BREAKER_FAILS_KEY);
}

/** Record a failure — opens the breaker once the threshold is crossed. */
export async function recordFailure(): Promise<void> {
  const fails = await redis.incr(BREAKER_FAILS_KEY);
  await redis.expire(BREAKER_FAILS_KEY, COOLDOWN_SECONDS * 5);
  if (fails >= FAILURE_THRESHOLD) {
    await redis.set(BREAKER_KEY, 'open', 'EX', COOLDOWN_SECONDS);
    await redis.del(BREAKER_FAILS_KEY);
  }
}
