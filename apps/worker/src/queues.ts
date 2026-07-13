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
  ai: 'ai', // AI-bound jobs (PSC scrape, gulf translate, knmc, ...)
  alerts: 'alerts', // job -> matching subscriptions
  dispatch: 'dispatch', // outbound WhatsApp/notification dispatch
  maintenance: 'maintenance', // periodic housekeeping (stat rollups, ...)
  jobEmbedding: 'job-embedding',
  alertDispatch: 'alert-dispatch',
  pscScrape: 'psc-scrape',
  fitScore: 'fit-score',
  notification: 'notification',
  email: 'email', // transactional email notifications (Phase 3.7)
  webhook: 'webhook', // employer webhook delivery (Phase 4.6)
  gdpr: 'gdpr', // GDPR data-export generation + deletion processing (Phase 4.8)
  integration: 'integration', // external integration push (Slack/Zapier/Airtable/HubSpot) (Phase 4.9)
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Dispatch payloads are discriminated by `kind`.
export type DispatchPayload =
  | { kind: 'psc_alert'; userId: string; categoryNo: string; event: string }
  | { kind: 'job_alert'; userId: string; jobId: string };

// ── Typed job payloads ──────────────────────────────────────────────────
export interface JobPayloads {
  [QUEUE_NAMES.ai]: Record<string, unknown>; // job.name dispatches (e.g. 'psc.scrape')
  [QUEUE_NAMES.alerts]: { jobId: string };
  [QUEUE_NAMES.dispatch]: Record<string, unknown>; // job.name dispatches (psc_alert, whatsapp_job)
  [QUEUE_NAMES.maintenance]: Record<string, unknown>; // job.name dispatches
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
  [QUEUE_NAMES.email]: {
    eventType: 'chat_message' | 'endorsement' | 'job_expiry' | 'application';
    userId: string; // recipient
    context: Record<string, unknown>;
  };
  [QUEUE_NAMES.webhook]: {
    webhookId: string;
    event: string;
    timestamp: string;
    data: Record<string, unknown>;
  };
  [QUEUE_NAMES.gdpr]:
    | { kind: 'export'; exportId: string; userId: string }
    | { kind: 'deletion'; deletionId: string; userId: string };
  [QUEUE_NAMES.integration]: {
    integrationId: string;
    event: string;
    data: Record<string, unknown>;
  };
}

export const queues = {
  ai: new Queue<JobPayloads['ai']>(QUEUE_NAMES.ai, baseQueueOptions),
  alerts: new Queue<JobPayloads['alerts']>(QUEUE_NAMES.alerts, baseQueueOptions),
  dispatch: new Queue<JobPayloads['dispatch']>(QUEUE_NAMES.dispatch, baseQueueOptions),
  maintenance: new Queue<JobPayloads['maintenance']>(QUEUE_NAMES.maintenance, baseQueueOptions),
  jobEmbedding: new Queue<JobPayloads['job-embedding']>(QUEUE_NAMES.jobEmbedding, baseQueueOptions),
  alertDispatch: new Queue<JobPayloads['alert-dispatch']>(QUEUE_NAMES.alertDispatch, baseQueueOptions),
  pscScrape: new Queue<JobPayloads['psc-scrape']>(QUEUE_NAMES.pscScrape, baseQueueOptions),
  fitScore: new Queue<JobPayloads['fit-score']>(QUEUE_NAMES.fitScore, baseQueueOptions),
  notification: new Queue<JobPayloads['notification']>(QUEUE_NAMES.notification, baseQueueOptions),
  email: new Queue<JobPayloads['email']>(QUEUE_NAMES.email, baseQueueOptions),
  webhook: new Queue<JobPayloads['webhook']>(QUEUE_NAMES.webhook, baseQueueOptions),
  gdpr: new Queue<JobPayloads['gdpr']>(QUEUE_NAMES.gdpr, baseQueueOptions),
  integration: new Queue<JobPayloads['integration']>(QUEUE_NAMES.integration, baseQueueOptions),
} as const;

export { baseQueueOptions, bullPrefix };
