import { z } from 'zod';
import type { Processor } from 'bullmq';
import type { JobPayloads } from '../queues.js';

const schema = z.object({ jobId: z.string().uuid(), seekerUserId: z.string().uuid() });

// Computes a seeker↔job fit score via callAI (Sonnet) and upserts fit_scores.
// Scoring orchestration lands with the matching feature.
export const fitScoreProcessor: Processor<JobPayloads['fit-score']> = async (job) => {
  const { jobId, seekerUserId } = schema.parse(job.data);
  console.log(`[fit-score] job ${jobId} seeker ${seekerUserId}`);
  return { jobId, seekerUserId, status: 'acknowledged' as const };
};
