import { z } from 'zod';
import type { Processor } from 'bullmq';
import type { JobPayloads } from '../queues.js';

const schema = z.object({ jobId: z.string().uuid() });

// Backfills the pgvector embedding for a job. Embedding generation logic lands
// with the search feature; this scaffold validates the payload and acknowledges.
export const jobEmbeddingProcessor: Processor<JobPayloads['job-embedding']> = async (job) => {
  const { jobId } = schema.parse(job.data);
  console.log(`[job-embedding] received job ${jobId}`);
  return { jobId, status: 'acknowledged' as const };
};
