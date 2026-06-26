import type { Job } from 'bullmq';
import { and, db, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { queues } from '../queues.js';

const CRON_JOB_ID = 'itpark-stats-cron';
const JOB_NAME = 'itpark.stats';

/** Register the hourly IT-park active-jobs rollup. */
export async function registerItParkStatsCron(): Promise<void> {
  await queues.maintenance.add(
    JOB_NAME,
    {},
    { repeat: { pattern: '0 * * * *' }, jobId: CRON_JOB_ID, removeOnComplete: true },
  );
}

/** maintenance-queue processor — routes by job.name. */
export async function maintenanceQueueProcessor(job: Job): Promise<unknown> {
  if (job.name === JOB_NAME) return runItParkStats();
  console.warn(`[maintenance] unhandled job ${job.name}`);
  return { skipped: true };
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
