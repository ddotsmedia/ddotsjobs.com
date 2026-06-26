import { Worker, type Processor } from 'bullmq';
import { db, eq, tables } from '@ddotsjobs/db';
import { baseQueueOptions, connection, QUEUE_NAMES, type QueueName } from './queues.js';
import { logger } from './lib/logger.js';
import { aiQueueProcessor, registerPscCron } from './workers/psc.worker.js';
import { maintenanceQueueProcessor, registerBudgetCron, registerItParkStatsCron } from './workers/itpark-stats.worker.js';
import { alertsQueueProcessor } from './workers/alerts.worker.js';
import { dispatchQueueProcessor } from './workers/dispatch.worker.js';
import { jobEmbeddingProcessor } from './workers/job-embedding.worker.js';
import { alertDispatchProcessor } from './workers/alert-dispatch.worker.js';
import { pscScrapeProcessor } from './workers/psc-scrape.worker.js';
import { fitScoreProcessor } from './workers/fit-score.worker.js';
import { notificationProcessor } from './workers/notification.worker.js';

// Single fork process hosting every BullMQ worker (PM2 ddotsjobs-worker).
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

function jobDuration(job: { processedOn?: number | null; finishedOn?: number | null }): number | null {
  if (job.processedOn && job.finishedOn) return job.finishedOn - job.processedOn;
  return null;
}

function makeWorker(name: QueueName, processor: Processor): Worker {
  const worker = new Worker(name, processor, {
    connection,
    prefix: baseQueueOptions.prefix,
    concurrency: CONCURRENCY,
  });
  worker.on('completed', (job) =>
    logger.info({ task: name, jobId: job.id, durationMs: jobDuration(job) }, 'Worker job completed'),
  );
  worker.on('failed', (job, err) =>
    logger.error({ task: name, jobId: job?.id, error: err.message }, 'Worker job failed'),
  );
  return worker;
}

// AI queue — concurrency 1 (PSC scrape + future AI jobs). On final failure,
// record to audit_log and continue.
const aiWorker = new Worker(QUEUE_NAMES.ai, aiQueueProcessor, {
  connection,
  prefix: baseQueueOptions.prefix,
  // PSC scrape (rare cron) + gulf translate (spec concurrency 3) share this queue.
  concurrency: 3,
});
aiWorker.on('completed', (job) =>
  logger.info({ task: 'ai', name: job.name, jobId: job.id, durationMs: jobDuration(job) }, 'Worker job completed'),
);
aiWorker.on('failed', async (job, err) => {
  logger.error({ task: 'ai', name: job?.name, jobId: job?.id, error: err.message }, 'Worker job failed');
  const attempts = job?.opts.attempts ?? 1;
  if (job && job.attemptsMade >= attempts) {
    // On terminal KNMC failure, fall back to manual review.
    if (job.name === 'verify_professional_registration') {
      const regId = (job.data as { registrationId?: string }).registrationId;
      if (regId) {
        try {
          await db
            .update(tables.professionalRegistrations)
            .set({
              statusCode: 'manual_review',
              status: 'pending',
              verifierNotes: 'Automated verification failed - manual review',
            })
            .where(eq(tables.professionalRegistrations.id, regId));
        } catch (e) {
          console.error(`[ai] knmc manual_review fallback failed: ${String(e)}`);
        }
      }
    }
    try {
      await db.insert(tables.auditLog).values({
        action: 'ai_job_failed',
        entityType: 'queue:ai',
        diff: { jobName: job.name, error: err.message },
      });
    } catch (e) {
      console.error(`[ai] audit_log insert failed: ${String(e)}`);
    }
  }
});

// Maintenance queue — hourly stat rollups (concurrency 1).
const maintenanceWorker = new Worker(QUEUE_NAMES.maintenance, maintenanceQueueProcessor, {
  connection,
  prefix: baseQueueOptions.prefix,
  concurrency: 1,
});
maintenanceWorker.on('failed', (job, err) =>
  logger.error({ task: 'maintenance', name: job?.name, error: err.message }, 'job failed'),
);

// Alerts matching (concurrency 5) and WhatsApp dispatch (concurrency 3, 30/min).
const alertsWorker = new Worker(QUEUE_NAMES.alerts, alertsQueueProcessor, {
  connection,
  prefix: baseQueueOptions.prefix,
  concurrency: 5,
});
alertsWorker.on('failed', (job, err) => logger.error({ task: 'alerts', jobId: job?.id, error: err.message }, 'job failed'));

const dispatchWorker = new Worker(QUEUE_NAMES.dispatch, dispatchQueueProcessor, {
  connection,
  prefix: baseQueueOptions.prefix,
  concurrency: 3,
  limiter: { max: 30, duration: 60_000 },
});
dispatchWorker.on('failed', (job, err) => logger.error({ task: 'dispatch', jobId: job?.id, error: err.message }, 'job failed'));

const workers: Worker[] = [
  aiWorker,
  maintenanceWorker,
  alertsWorker,
  dispatchWorker,
  makeWorker(QUEUE_NAMES.jobEmbedding, jobEmbeddingProcessor as Processor),
  makeWorker(QUEUE_NAMES.alertDispatch, alertDispatchProcessor as Processor),
  makeWorker(QUEUE_NAMES.pscScrape, pscScrapeProcessor as Processor),
  makeWorker(QUEUE_NAMES.fitScore, fitScoreProcessor as Processor),
  makeWorker(QUEUE_NAMES.notification, notificationProcessor as Processor),
];

// Register repeatable crons (idempotent — keyed by jobId).
registerPscCron()
  .then(() => logger.info('[ai] PSC scrape cron registered (0 */4 * * *)'))
  .catch((err: unknown) => logger.error({ err }, '[ai] cron registration failed'));
registerItParkStatsCron()
  .then(() => logger.info('[maintenance] IT park stats cron registered (0 * * * *)'))
  .catch((err: unknown) => logger.error({ err }, '[maintenance] cron registration failed'));
registerBudgetCron()
  .then(() => logger.info('[maintenance] AI budget cron registered (0 9 * * *)'))
  .catch((err: unknown) => logger.error({ err }, '[maintenance] budget cron registration failed'));

logger.info({ queues: workers.length, concurrency: CONCURRENCY }, 'ddotsjobs-worker up');

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received — draining workers`);
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
