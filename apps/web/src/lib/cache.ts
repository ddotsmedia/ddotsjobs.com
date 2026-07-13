import { redis } from '@ddotsjobs/redis';

// Generic get-or-set JSON cache over the shared redis client (auto-prefixed with
// "ddotsjobs:"). Never throws on redis failure — always falls back to the loader.
//
// TTL presets (seconds) matching the perf plan:
export const TTL = {
  jobListing: 3600, // 1 hour
  userProfile: 1800, // 30 min
  employerBranding: 86_400, // 24 hours
  referralLeaderboard: 21_600, // 6 hours
} as const;

const keyFor = (ns: string, id: string) => `cache:${ns}:${id}`;

export async function cached<T>(ns: string, id: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
  const k = keyFor(ns, id);
  try {
    const hit = await redis.get(k);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    // redis down — skip cache read
  }
  const value = await loader();
  try {
    await redis.set(k, JSON.stringify(value), 'EX', ttlSec);
  } catch {
    // ignore cache write failure
  }
  return value;
}

// Invalidate one cached entry (call after a mutation changes the source data).
export async function invalidate(ns: string, id: string): Promise<void> {
  try {
    await redis.del(keyFor(ns, id));
  } catch {
    // ignore
  }
}
