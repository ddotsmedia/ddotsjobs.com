import { createHmac } from 'node:crypto';
import type { Job, Processor } from 'bullmq';
import { and, db, eq, tables } from '@ddotsjobs/db';
import { logger } from '../lib/logger.js';
import type { JobPayloads } from '../queues.js';

// Delivers one webhook event. BullMQ handles the retry/backoff (attempts:6,
// exponential from 1s → 1,2,4,8,16s). We log the final outcome once.
export const webhookProcessor: Processor<JobPayloads['webhook']> = async (job: Job<JobPayloads['webhook']>) => {
  const { webhookId, event, timestamp, data } = job.data;
  const [wh] = await db
    .select({ url: tables.webhooks.url, secret: tables.webhooks.secret, isActive: tables.webhooks.isActive })
    .from(tables.webhooks)
    .where(and(eq(tables.webhooks.id, webhookId)))
    .limit(1);
  if (!wh || !wh.isActive) return { skipped: 'inactive' as const };

  const payload = JSON.stringify({ event, timestamp, data });
  const signature = `sha256=${createHmac('sha256', wh.secret).update(payload).digest('hex')}`;
  const attempts = job.opts.attempts ?? 1;
  const isFinal = job.attemptsMade + 1 >= attempts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(wh.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': signature, 'x-ddotsjobs-event': event },
      body: payload,
      signal: controller.signal,
    });
    const body = (await res.text().catch(() => '')).slice(0, 2000);
    if (res.ok) {
      await db.insert(tables.webhookLogs).values({ webhookId, eventType: event, statusCode: res.status, response: body, retries: job.attemptsMade, succeededAt: new Date() });
      await db.update(tables.webhooks).set({ lastTriggeredAt: new Date() }).where(eq(tables.webhooks.id, webhookId));
      return { ok: true as const, status: res.status };
    }
    if (isFinal) {
      await db.insert(tables.webhookLogs).values({ webhookId, eventType: event, statusCode: res.status, response: body, retries: job.attemptsMade, failedAt: new Date() });
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // Network/timeout (no status). Log the final failure once.
    if (isFinal && !(err instanceof Error && err.message.startsWith('HTTP '))) {
      await db.insert(tables.webhookLogs).values({ webhookId, eventType: event, statusCode: null, response: (err as Error).message.slice(0, 2000), retries: job.attemptsMade, failedAt: new Date() });
    }
    logger.warn({ webhookId, event, attempt: job.attemptsMade + 1 }, '[webhook] delivery failed');
    throw err; // BullMQ retries with backoff
  } finally {
    clearTimeout(timer);
  }
};
