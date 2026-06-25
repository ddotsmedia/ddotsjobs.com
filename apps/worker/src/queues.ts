import { Queue, type QueueOptions } from 'bullmq';
import { createRawConnection, KEY_PREFIX } from '@ddotsjobs/redis';

// All BullMQ queues share one Redis connection and the ddotsjobs key prefix so
// they never collide with the 12 other projects on the shared instance.
export const connection = createRawConnection();

// BullMQ requires a prefix WITHOUT a trailing colon (it adds its own).
const bullPrefix = KEY_PREFIX.replace(/:$/, '');

const baseQueueOptions: QueueOptions = {
  connection,
  prefix: bullPrefix,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 1000, age: 60 * 60 * 24 },
    removeOnFail: { count: 5000, age: 60 * 60 * 24 * 7 },
  },
};

// Canonical queue names. One queue per async domain.
export const QUEUE_NAMES = {
  jobEmbedding: 'job-embedding',
  alertDispatch: 'alert-dispatch',
  pscScrape: 'psc-scrape',
  fitScore: 'fit-score',
  notification: 'notification',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ── Typed job payloads ──────────────────────────────────────────────────
export interface JobPayloads {
  [QUEUE_NAMES.jobEmbedding]: { jobId: string };
  [QUEUE_NAMES.alertDispatch]: { subscriptionId: string; jobId: string };
  [QUEUE_NAMES.pscScrape]: { sourceUrl?: string };
  [QUEUE_NAMES.fitScore]: { jobId: string; seekerUserId: string };
  [QUEUE_NAMES.notification]: {
    channel: 'whatsapp' | 'email' | 'push' | 'sms';
    to: string;
    templateMl: string;
    templateEn: string;
  };
}

export const queues = {
  jobEmbedding: new Queue<JobPayloads['job-embedding']>(QUEUE_NAMES.jobEmbedding, baseQueueOptions),
  alertDispatch: new Queue<JobPayloads['alert-dispatch']>(QUEUE_NAMES.alertDispatch, baseQueueOptions),
  pscScrape: new Queue<JobPayloads['psc-scrape']>(QUEUE_NAMES.pscScrape, baseQueueOptions),
  fitScore: new Queue<JobPayloads['fit-score']>(QUEUE_NAMES.fitScore, baseQueueOptions),
  notification: new Queue<JobPayloads['notification']>(QUEUE_NAMES.notification, baseQueueOptions),
} as const;

export { baseQueueOptions, bullPrefix };
