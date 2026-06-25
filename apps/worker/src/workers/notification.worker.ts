import { z } from 'zod';
import type { Processor } from 'bullmq';
import type { JobPayloads } from '../queues.js';

const schema = z.object({
  channel: z.enum(['whatsapp', 'email', 'push', 'sms']),
  to: z.string().min(1),
  templateMl: z.string(),
  templateEn: z.string(),
});

// Sends a bilingual notification over the requested channel. Provider clients
// (Green API / Resend / push) wire in with the notifications feature.
export const notificationProcessor: Processor<JobPayloads['notification']> = async (job) => {
  const data = schema.parse(job.data);
  console.log(`[notification] ${data.channel} -> ${data.to}`);
  return { channel: data.channel, status: 'acknowledged' as const };
};
