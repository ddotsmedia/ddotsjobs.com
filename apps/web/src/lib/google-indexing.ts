import 'server-only';
import { createSign } from 'node:crypto';
import { and, db, eq, isNull, tables } from '@ddotsjobs/db';

// Google Indexing API submission. No external SDK — mints a service-account JWT
// with node:crypto, exchanges it for an access token, then publishes the URL.
// GOOGLE_INDEXING_SA_KEY is a base64-encoded service-account JSON. If unset, all
// calls are silent no-ops. Errors are logged, never thrown.

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_INDEXING_SA_KEY;
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as ServiceAccount;
    if (!json.client_email || !json.private_key) return null;
    return json;
  } catch {
    return null;
  }
}

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(sa.private_key));
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function notifyGoogleIndexing(url: string): Promise<void> {
  const sa = loadServiceAccount();
  if (!sa) return; // not configured — skip silently

  try {
    const token = await getAccessToken(sa);
    if (!token) {
      console.warn('[google-indexing] could not obtain access token');
      return;
    }
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });
    if (!res.ok) {
      console.warn(`[google-indexing] publish failed ${res.status}`);
      return;
    }
    const slug = url.split('/').filter(Boolean).pop();
    if (slug) {
      await db
        .update(tables.jobs)
        .set({ googleIndexedAt: new Date() })
        .where(and(eq(tables.jobs.slug, slug), isNull(tables.jobs.deletedAt)));
    }
  } catch (err) {
    console.warn(`[google-indexing] error: ${String(err)}`);
  }
}
