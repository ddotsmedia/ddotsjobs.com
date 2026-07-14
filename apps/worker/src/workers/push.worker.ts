import type { Job, Processor } from 'bullmq';
import { and, db, eq, tables } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';
import { decryptSecret } from '@ddotsjobs/config/crypto';
import { logger } from '../lib/logger.js';
import { fcmConfigured, sendPush } from '../lib/fcm.js';
import type { JobPayloads } from '../queues.js';

type Payload = JobPayloads['push'];
const HOURLY_CAP = 5;

const PREF_COLUMN = {
  messages: 'pushMessages',
  job_alerts: 'pushJobAlerts',
  applications: 'pushApplications',
  endorsements: 'pushEndorsements',
} as const;

// Current hour-of-day in IST (India, UTC+5:30) — quiet hours are expressed in IST.
function istHour(): number {
  return new Date(Date.now() + 5.5 * 3_600_000).getUTCHours();
}

function inQuietHours(hour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null) return false;
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export const pushProcessor: Processor<Payload> = async (job: Job<Payload>) => {
  const { userId, category, title, body, actionUrl } = job.data;

  // 1. Preference gate (row absent = all defaults on).
  const [prefs] = await db
    .select({
      pushMessages: tables.pushPreferences.pushMessages,
      pushJobAlerts: tables.pushPreferences.pushJobAlerts,
      pushApplications: tables.pushPreferences.pushApplications,
      pushEndorsements: tables.pushPreferences.pushEndorsements,
      quietStartHour: tables.pushPreferences.quietStartHour,
      quietEndHour: tables.pushPreferences.quietEndHour,
    })
    .from(tables.pushPreferences)
    .where(eq(tables.pushPreferences.userId, userId))
    .limit(1);

  if (prefs && prefs[PREF_COLUMN[category]] === false) return { skipped: 'pref' };

  // 2. Quiet hours.
  if (prefs && inQuietHours(istHour(), prefs.quietStartHour, prefs.quietEndHour)) return { skipped: 'quiet' };

  // 3. Rate limit: max 5 pushes / user / hour.
  const rlKey = `push:rl:${userId}`;
  const n = await redis.incr(rlKey);
  if (n === 1) await redis.expire(rlKey, 3600);
  if (n > HOURLY_CAP) return { skipped: 'rate' };

  // 4. Record the notification (feed + badge), regardless of device delivery.
  const [record] = await db
    .insert(tables.pushNotifications)
    .values({ userId, title, body, actionUrl: actionUrl ?? null })
    .returning({ id: tables.pushNotifications.id });

  // 5. Active device tokens.
  const tokens = await db
    .select({ id: tables.deviceTokens.id, token: tables.deviceTokens.token })
    .from(tables.deviceTokens)
    .where(and(eq(tables.deviceTokens.userId, userId), eq(tables.deviceTokens.isActive, true)));

  if (tokens.length === 0) return { stored: true, sent: 0 };
  if (!fcmConfigured()) {
    logger.warn('FCM not configured — push recorded but not delivered');
    return { stored: true, sent: 0, skipped: 'unconfigured' };
  }

  const data: Record<string, string> = { notificationId: record!.id };
  if (actionUrl) data.actionUrl = actionUrl;

  let sent = 0;
  for (const t of tokens) {
    let plain: string;
    try {
      plain = decryptSecret(t.token);
    } catch {
      await db.update(tables.deviceTokens).set({ isActive: false }).where(eq(tables.deviceTokens.id, t.id));
      continue;
    }
    const result = await sendPush(plain, { title, body }, data);
    if (result === 'sent') sent += 1;
    else if (result === 'invalid') await db.update(tables.deviceTokens).set({ isActive: false }).where(eq(tables.deviceTokens.id, t.id));
  }

  if (sent > 0) await db.update(tables.pushNotifications).set({ deliveredAt: new Date() }).where(eq(tables.pushNotifications.id, record!.id));
  return { stored: true, sent };
};
