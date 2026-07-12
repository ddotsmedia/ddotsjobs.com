import 'server-only';
import { and, db, eq, sql, tables } from '@ddotsjobs/db';
import { webhookQueue } from '@/server/queue';

const ATTEMPTS = 6; // initial + 5 retries, exponential backoff 1,2,4,8,16s

// Fan an event out to the employer's active webhooks subscribed to it. Enqueues
// one delivery job per webhook. Best-effort — never blocks the caller.
export async function emitWebhookEvent(employerId: string, event: string, data: Record<string, unknown>): Promise<void> {
  try {
    const hooks = await db
      .select({ id: tables.webhooks.id })
      .from(tables.webhooks)
      .where(and(eq(tables.webhooks.employerId, employerId), eq(tables.webhooks.isActive, true), sql`${event} = ANY(${tables.webhooks.events})`));
    if (hooks.length === 0) return;
    const timestamp = new Date().toISOString();
    for (const h of hooks) {
      await webhookQueue.add(
        'deliver',
        { webhookId: h.id, event, timestamp, data },
        { attempts: ATTEMPTS, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true, removeOnFail: 200 },
      );
    }
  } catch {
    /* webhooks are best-effort */
  }
}
