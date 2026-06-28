import { TRPCError } from '@trpc/server';

// Minimal structural type — avoids a direct ioredis dependency in the web app.
interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

/**
 * Fixed-window rate limiter backed by Redis. Throws TOO_MANY_REQUESTS when the
 * count for `key` exceeds `max` within `windowSec`. Keys are namespaced by the
 * shared ddotsjobs: prefix (applied by the redis client).
 */
export async function rateLimit(redis: RedisLike, key: string, max: number, windowSec: number): Promise<void> {
  const k = `ratelimit:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  if (n > max) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Please try again later.' });
  }
}
