import { z } from 'zod';
import type { Processor } from 'bullmq';
import type { JobPayloads } from '../queues.js';

const schema = z.object({ subscriptionId: z.string().uuid(), jobId: z.string().uuid() });

// Delivers a matched job to one alert subscription. Channel delivery + dedup
// against alert_dispatch_log land with the alerts feature.
export const alertDispatchProcessor: Processor<JobPayloads['alert-dispatch']> = async (job) => {
  const { subscriptionId, jobId } = schema.parse(job.data);
  console.log(`[alert-dispatch] subscription ${subscriptionId} job ${jobId}`);
  return { subscriptionId, jobId, status: 'acknowledged' as const };
};
