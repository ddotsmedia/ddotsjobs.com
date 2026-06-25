import { Worker, type Processor } from 'bullmq';
import { baseQueueOptions, connection, QUEUE_NAMES, type QueueName } from './queues.js';
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

const workers: Worker[] = [
  makeWorker(QUEUE_NAMES.jobEmbedding, jobEmbeddingProcessor as Processor),
  makeWorker(QUEUE_NAMES.alertDispatch, alertDispatchProcessor as Processor),
  makeWorker(QUEUE_NAMES.pscScrape, pscScrapeProcessor as Processor),
  makeWorker(QUEUE_NAMES.fitScore, fitScoreProcessor as Processor),
  makeWorker(QUEUE_NAMES.notification, notificationProcessor as Processor),
];

console.log(`ddotsjobs-worker up — ${workers.length} queues, concurrency ${CONCURRENCY}`);

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received — draining workers`);
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
