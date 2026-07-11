import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, db, eq, isNull, tables } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';

export const API_KEY_PREFIX = 'ddj_live_';

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `${API_KEY_PREFIX}${randomBytes(24).toString('hex')}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 16) };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export interface ApiAuth {
  keyId: string;
  employerId: string;
  ownerUserId: string;
}

// Resolve the employer behind a `Authorization: Bearer <key>` header.
export async function authenticateApiKey(req: Request): Promise<ApiAuth | null> {
  const header = req.headers.get('authorization') ?? '';
  const m = header.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const k = tables.apiKeys;
  const [row] = await db
    .select({ id: k.id, employerId: k.employerId, ownerUserId: tables.employers.ownerUserId })
    .from(k)
    .innerJoin(tables.employers, eq(tables.employers.id, k.employerId))
    .where(and(eq(k.keyHash, hashApiKey(m[1]!)), isNull(k.revokedAt), isNull(tables.employers.deletedAt)))
    .limit(1);
  if (!row) return null;
  void db.update(k).set({ lastUsedAt: new Date() }).where(eq(k.id, row.id)).catch(() => {});
  return { keyId: row.id, employerId: row.employerId, ownerUserId: row.ownerUserId };
}

// Fixed-window per-key limiter. Returns true if the request is within budget.
export async function apiRateLimit(keyId: string, bucket: string, max: number, windowSec: number): Promise<boolean> {
  const rk = `apiratelimit:${bucket}:${keyId}`;
  const n = await redis.incr(rk);
  if (n === 1) await redis.expire(rk, windowSec);
  return n <= max;
}

export function jsonError(status: number, message: string, code?: string): NextResponse {
  return NextResponse.json({ error: { code: code ?? String(status), message } }, { status });
}

// Standard guard used by every v1 route: auth + the 1000 req/day limit.
export async function guard(req: Request): Promise<{ auth: ApiAuth } | { res: NextResponse }> {
  const auth = await authenticateApiKey(req);
  if (!auth) return { res: jsonError(401, 'Invalid or missing API key.', 'unauthorized') };
  if (!(await apiRateLimit(auth.keyId, 'req', 1000, 86_400))) {
    return { res: jsonError(429, 'Daily request limit reached (1000/day).', 'rate_limited') };
  }
  return { auth };
}
