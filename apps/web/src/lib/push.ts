import 'server-only';
import { pushQueue } from '@/server/queue';

export type PushCategory = 'messages' | 'job_alerts' | 'applications' | 'endorsements';

// Best-effort enqueue of a mobile push. The worker handles preference gating,
// quiet hours, rate limiting and FCM delivery. Never breaks the caller.
export async function emitPush(
  userId: string,
  category: PushCategory,
  title: string,
  body: string,
  actionUrl?: string,
): Promise<void> {
  try {
    await pushQueue.add(
      category,
      { userId, category, title, body, actionUrl },
      { attempts: 2, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: true, removeOnFail: 200 },
    );
  } catch {
    /* push is non-critical */
  }
}
