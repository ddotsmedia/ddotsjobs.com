import { z } from 'zod';
import type { Processor } from 'bullmq';
import type { JobPayloads } from '../queues.js';

const schema = z.object({ sourceUrl: z.string().url().optional() });

// Scrapes + normalizes Kerala PSC notifications. Scrape + upsert (ON CONFLICT
// DO NOTHING) logic lands with the PSC feature.
export const pscScrapeProcessor: Processor<JobPayloads['psc-scrape']> = async (job) => {
  const { sourceUrl } = schema.parse(job.data);
  console.log(`[psc-scrape] source ${sourceUrl ?? 'default'}`);
  return { status: 'acknowledged' as const };
};
