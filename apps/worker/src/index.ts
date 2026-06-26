import { Worker, type Processor } from 'bullmq';
import { db, tables } from '@ddotsjobs/db';
import { baseQueueOptions, connection, QUEUE_NAMES, type QueueName } from './queues.js';
import { aiQueueProcessor, registerPscCron } from './workers/psc.worker.js';
import { maintenanceQueueProcessor, registerItParkStatsCron } from './workers/itpark-stats.worker.js';
import { jobEmbeddingProcessor } from './workers/job-embedding.worker.js';
import { alertDispatchProcessor } from './workers/alert-dispatch.worker.js';
import { pscScrapeProcessor } from './workers/psc-scrape.worker.js';
import { fitScoreProcessor } from './workers/fit-score.worker.js';
import { notificationProcessor } from './workers/notification.worker.js';

// Single fork process hosting every BullMQ worker (PM2 ddotsjobs-worker).
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

function makeWorker(name: QueueName, processor: Processor): Worker {
  const worker = new Worker(name, processor, {
    connection,
    prefix: baseQueueOptions.prefix,
    concurrency: CONCURRENCY,
  });
  worker.on('completed', (job) => console.log(`[${name}] completed ${job.id}`));
  worker.on('failed', (job, err) =>
    console.error(`[${name}] failed ${job?.id ?? '?'}: ${err.message}`),
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
aiWorker.on('completed', (job) => console.log(`[ai] completed ${job.name} ${job.id}`));
aiWorker.on('failed', async (job, err) => {
  console.error(`[ai] failed ${job?.name} ${job?.id}: ${err.message}`);
  const attempts = job?.opts.attempts ?? 1;
  if (job && job.attemptsMade >= attempts) {
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
  console.error(`[maintenance] failed ${job?.name}: ${err.message}`),
);

const workers: Worker[] = [
  aiWorker,
  maintenanceWorker,
  makeWorker(QUEUE_NAMES.jobEmbedding, jobEmbeddingProcessor as Processor),
  makeWorker(QUEUE_NAMES.alertDispatch, alertDispatchProcessor as Processor),
  makeWorker(QUEUE_NAMES.pscScrape, pscScrapeProcessor as Processor),
  makeWorker(QUEUE_NAMES.fitScore, fitScoreProcessor as Processor),
  makeWorker(QUEUE_NAMES.notification, notificationProcessor as Processor),
];

// Register repeatable crons (idempotent — keyed by jobId).
registerPscCron()
  .then(() => console.log('[ai] PSC scrape cron registered (0 */4 * * *)'))
  .catch((err: unknown) => console.error('[ai] cron registration failed:', err));
registerItParkStatsCron()
  .then(() => console.log('[maintenance] IT park stats cron registered (0 * * * *)'))
  .catch((err: unknown) => console.error('[maintenance] cron registration failed:', err));

console.log(`ddotsjobs-worker up — ${workers.length} queues, concurrency ${CONCURRENCY}`);

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received — draining workers`);
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
