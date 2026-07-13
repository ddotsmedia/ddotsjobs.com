import 'server-only';
import { and, db, eq, tables } from '@ddotsjobs/db';
import { integrationQueue } from '@/server/queue';

// Fan an employer event out to their connected integrations that have the event
// push-enabled. Best-effort — never let integration failures break the caller.
export async function emitIntegrationEvent(
  employerId: string,
  event: 'job_posted' | 'application_received' | 'offer_sent',
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const rows = await db
      .select({ id: tables.integrations.id })
      .from(tables.integrations)
      .innerJoin(
        tables.integrationEvents,
        and(
          eq(tables.integrationEvents.integrationId, tables.integrations.id),
          eq(tables.integrationEvents.eventType, event),
          eq(tables.integrationEvents.isPushEnabled, true),
        ),
      )
      .where(and(eq(tables.integrations.employerId, employerId), eq(tables.integrations.isConnected, true)));

    await Promise.all(
      rows.map((r) =>
        integrationQueue.add(
          'push',
          { integrationId: r.id, event, data },
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 200 },
        ),
      ),
    );
  } catch {
    /* integrations are non-critical */
  }
}
