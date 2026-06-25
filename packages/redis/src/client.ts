import { Redis, type RedisOptions } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
/** Namespace for every ddotsjobs key on the shared Redis instance. */
export const KEY_PREFIX = process.env.REDIS_KEY_PREFIX ?? 'ddotsjobs:';

/**
 * Base ioredis options shared by all connections. `maxRetriesPerRequest: null`
 * and `enableReadyCheck: false` are required by BullMQ for blocking commands.
 */
const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
};

/**
 * General-purpose client. Every key is automatically namespaced with KEY_PREFIX
 * by ioredis, so callers use bare keys (e.g. `cache:job:123`).
 */
export const redis = new Redis(REDIS_URL, { ...baseOptions, keyPrefix: KEY_PREFIX });

/**
 * Raw connection factory WITHOUT ioredis keyPrefix. BullMQ manages its own key
 * namespacing via its `prefix` option, so queues/workers must use this and pass
 * `prefix: KEY_PREFIX` to BullMQ — never the keyPrefix'd `redis` above.
 */
export function createRawConnection(options: RedisOptions = {}): Redis {
  return new Redis(REDIS_URL, { ...baseOptions, ...options });
}

export { Redis };
export type { RedisOptions };
