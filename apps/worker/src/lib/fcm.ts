import { createSign } from 'node:crypto';
import { redis } from '@ddotsjobs/redis';
import { logger } from './logger.js';

// FCM HTTP v1 sender using a service-account JWT minted with node:crypto (RS256).
// Deliberately dependency-free — avoids pulling firebase-admin into the worker's
// lockfile. Fully functional when FCM_SERVICE_ACCOUNT is set; a clean no-op when
// it isn't (mirrors the RESEND_API_KEY email gate).

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let cachedSa: ServiceAccount | null | undefined;

function serviceAccount(): ServiceAccount | null {
  if (cachedSa !== undefined) return cachedSa;
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) {
    cachedSa = null;
    return null;
  }
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    cachedSa = sa.client_email && sa.private_key && sa.project_id ? sa : null;
  } catch {
    logger.error('FCM_SERVICE_ACCOUNT is not valid JSON');
    cachedSa = null;
  }
  return cachedSa;
}

export function fcmConfigured(): boolean {
  return serviceAccount() !== null;
}

const b64url = (buf: Buffer | string): string => Buffer.from(buf).toString('base64url');

// Exchange the service-account JWT for an OAuth2 access token (cached in redis).
async function accessToken(sa: ServiceAccount): Promise<string> {
  const cacheKey = 'push:fcm:access_token';
  try {
    const hit = await redis.get(cacheKey);
    if (hit) return hit;
  } catch {
    /* redis down — mint fresh */
  }

  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.private_key, 'base64url');
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`FCM token exchange ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  try {
    await redis.set(cacheKey, json.access_token, 'EX', Math.max(60, json.expires_in - 120));
  } catch {
    /* ignore cache write */
  }
  return json.access_token;
}

export type SendResult = 'sent' | 'invalid' | 'skipped' | 'error';

// Send one push. Returns 'invalid' when the token is stale (caller deactivates).
export async function sendPush(
  token: string,
  notification: { title: string; body: string },
  data: Record<string, string>,
): Promise<SendResult> {
  const sa = serviceAccount();
  if (!sa) return 'skipped';

  let bearer: string;
  try {
    bearer = await accessToken(sa);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'FCM access token failed');
    return 'error';
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        message: {
          token,
          notification: { title: notification.title, body: notification.body },
          data,
          android: { notification: { icon: 'ic_notification' } },
          webpush: { notification: { icon: 'https://ddotsjobs.com/favicon.svg' } },
        },
      }),
    });
    if (res.ok) return 'sent';
    // 404 NOT_FOUND / 400 with UNREGISTERED → token is dead.
    if (res.status === 404) return 'invalid';
    const text = await res.text().catch(() => '');
    if (res.status === 400 && /UNREGISTERED|INVALID_ARGUMENT/.test(text)) return 'invalid';
    logger.warn({ status: res.status, text: text.slice(0, 200) }, 'FCM send non-ok');
    return 'error';
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'FCM send failed');
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}
