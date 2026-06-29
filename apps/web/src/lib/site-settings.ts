import { TRPCError } from '@trpc/server';
import { db, eq, tables } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';

// Cached read of a site_settings row. The shared redis client auto-prefixes
// keys with "ddotsjobs:", so the bare cache key is `settings:<key>`.
const CACHE_TTL = 60; // seconds
const cacheKey = (key: string) => `settings:${key}`;

export async function getSetting(key: string, fallback = ''): Promise<string> {
  try {
    const cached = await redis.get(cacheKey(key));
    if (cached !== null) return cached;
  } catch {
    // redis down — fall through to DB.
  }
  try {
    const [row] = await db
      .select({ value: tables.siteSettings.value })
      .from(tables.siteSettings)
      .where(eq(tables.siteSettings.key, key))
      .limit(1);
    const value = row?.value ?? fallback;
    try {
      await redis.set(cacheKey(key), value, 'EX', CACHE_TTL);
    } catch {
      // ignore cache write failure
    }
    return value;
  } catch {
    return fallback;
  }
}

export async function isEnabled(key: string, fallback = true): Promise<boolean> {
  const val = await getSetting(key, fallback ? 'true' : 'false');
  return val === 'true';
}

// Shared guard for every AI procedure — throws if admin disabled AI features.
export async function assertAiEnabled(): Promise<void> {
  if (!(await isEnabled('ai_features_enabled', true))) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'AI features temporarily disabled. Please try again later.' });
  }
}

// Drop the cache for a key so the next read hits the DB immediately.
export async function clearSettingCache(key: string): Promise<void> {
  try {
    await redis.del(cacheKey(key));
  } catch {
    // ignore
  }
}
