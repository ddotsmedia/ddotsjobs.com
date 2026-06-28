import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

/**
 * Lazy runtime pool. Points at PgBouncer (transaction pooling, port 6432) in
 * production via DATABASE_POOL_URL; falls back to the direct cluster URL.
 * PgBouncer transaction mode forbids prepared statements — drizzle node-postgres
 * does not use them by default, so this is safe.
 *
 * Construction is deferred so that merely importing this module (e.g. during
 * `next build` page-data collection, when DB env may be absent) never throws.
 * The connection is created on first actual query.
 */
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_POOL_URL or DATABASE_URL must be set');
  }
  _pool = new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return _pool;
}

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) _db = drizzle(getPool(), { schema, casing: 'snake_case' });
  return _db;
}

// Lazy proxies — defer construction (and any missing-env throw) to first use,
// while preserving the `db.select(...)` / `pool.query(...)` call API.
export const pool = new Proxy({} as Pool, {
  get(_t, prop) {
    const target = getPool() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, prop) {
    const target = getDb() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  },
});

export type Database = ReturnType<typeof drizzle<typeof schema>>;
export { schema };
