import 'server-only';
import { Queue } from 'bullmq';
import { createRawConnection, KEY_PREFIX } from '@ddotsjobs/redis';

// Web-side BullMQ producers. Must use the same prefix/connection conventions as
// the worker (prefix without trailing colon; raw connection, not the keyPrefix
// client). Consumers run in apps/worker.
const prefix = KEY_PREFIX.replace(/:$/, '');
const connection = createRawConnection();

export const aiQueue = new Queue('ai', { connection, prefix });
export const alertsQueue = new Queue('alerts', { connection, prefix });
export const searchSyncQueue = new Queue('search-sync', { connection, prefix });

// Transactional email notifications (Phase 3.7). Consumed by apps/worker's
// email.worker. Payload: { eventType, userId (recipient), context }.
export const emailQueue = new Queue('email', { connection, prefix });

// Employer webhook delivery (Phase 4.6). Consumed by apps/worker's
// webhook.worker. Payload: { webhookId, event, timestamp, data }.
export const webhookQueue = new Queue('webhook', { connection, prefix });

// GDPR async jobs (Phase 4.8). Consumed by apps/worker's gdpr.worker.
// Payload: { kind: 'export'|'deletion', exportId?|deletionId?, userId }.
export const gdprQueue = new Queue('gdpr', { connection, prefix });

// External integration push (Phase 4.9). Consumed by apps/worker's
// integration.worker. Payload: { integrationId, event, data }.
export const integrationQueue = new Queue('integration', { connection, prefix });

// FCM mobile push (Phase 5.1). Consumed by apps/worker's push.worker.
// Payload: { userId, category, title, body, actionUrl? }.
export const pushQueue = new Queue('push', { connection, prefix });

export interface EmailJob {
  eventType: 'chat_message' | 'endorsement' | 'job_expiry' | 'application';
  userId: string;
  context: Record<string, unknown>;
}

// Best-effort enqueue — never let email failures break the triggering action.
export async function enqueueEmail(job: EmailJob): Promise<void> {
  try {
    await emailQueue.add(job.eventType, job, { removeOnComplete: true, attempts: 2 });
  } catch {
    /* email is non-critical */
  }
}
