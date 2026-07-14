import type { Job } from 'bullmq';
import { and, db, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';
import { queues } from '../queues.js';
import { logger } from '../lib/logger.js';
import { runAlertDigest } from './alert-digest.worker.js';
import { runJobExpiryCheck } from './email.worker.js';
import { runScheduledReports } from './reports.worker.js';

const CRON_JOB_ID = 'itpark-stats-cron';
const JOB_NAME = 'itpark.stats';
const BUDGET_JOB_ID = 'ai-budget-cron';
const BUDGET_JOB_NAME = 'budget_check';

/** Register the hourly IT-park active-jobs rollup. */
export async function registerItParkStatsCron(): Promise<void> {
  await queues.maintenance.add(
    JOB_NAME,
    {},
    { repeat: { pattern: '0 * * * *' }, jobId: CRON_JOB_ID, removeOnComplete: true },
  );
}

/** Register the daily 9am AI budget check. */
export async function registerBudgetCron(): Promise<void> {
  await queues.maintenance.add(
    BUDGET_JOB_NAME,
    {},
    { repeat: { pattern: '0 9 * * *' }, jobId: BUDGET_JOB_ID, removeOnComplete: true },
  );
}

/** maintenance-queue processor — routes by job.name. */
export async function maintenanceQueueProcessor(job: Job): Promise<unknown> {
  if (job.name === JOB_NAME) return runItParkStats();
  if (job.name === BUDGET_JOB_NAME) return runBudgetCheck();
  if (job.name === 'alert_digest_daily') return runAlertDigest('daily_digest');
  if (job.name === 'alert_digest_weekly') return runAlertDigest('weekly');
  if (job.name === 'job_expiry_check') return runJobExpiryCheck();
  if (job.name === 'scheduled_reports_weekly') return runScheduledReports('weekly');
  if (job.name === 'scheduled_reports_monthly') return runScheduledReports('monthly');
  logger.warn({ job: job.name }, '[maintenance] unhandled job');
  return { skipped: true };
}

export async function runBudgetCheck(): Promise<{ costUsd: number }> {
  const today = new Date().toISOString().split('T')[0]!;
  const costUsd = parseFloat((await redis.get(`ai:cost:${today}`)) ?? '0') || 0;
  const calls = (await redis.get(`ai:calls:${today}`)) ?? '0';

  if (costUsd > 10) {
    logger.warn({ costUsd }, 'AI daily budget exceeded $10');
    await redis.set('ai:circuit_breaker:active', '1', 'EX', 86_400);
  }
  if (costUsd > 15) {
    logger.error({ costUsd }, 'AI budget critical — circuit breaker ON');
  }
  logger.info({ date: today, costUsd, calls }, 'AI daily usage');
  return { costUsd };
}

export async function runItParkStats(): Promise<{ status: string; parks: number }> {
  const parks = await db.select({ id: tables.itParks.id, slug: tables.itParks.slug }).from(tables.itParks);

  for (const park of parks) {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(tables.jobs)
      .where(
        and(
          eq(tables.jobs.itParkId, park.id),
          eq(tables.jobs.status, 'active'),
          isNull(tables.jobs.deletedAt),
        ),
      );
    await db
      .update(tables.itParks)
      .set({ activeJobsCount: row?.c ?? 0 })
      .where(eq(tables.itParks.slug, park.slug));
  }

  console.log(`[maintenance] itpark stats updated — ${parks.length} parks`);
  return { status: 'ok', parks: parks.length };
}
