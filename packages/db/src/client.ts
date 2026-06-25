import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

/**
 * Runtime pool. Points at PgBouncer (transaction pooling, port 6432) in
 * production via DATABASE_POOL_URL; falls back to the direct cluster URL.
 * PgBouncer transaction mode forbids prepared statements — drizzle node-postgres
 * does not use them by default, so this is safe.
 */
const connectionString =
  process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_POOL_URL or DATABASE_URL must be set');
}

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema, casing: 'snake_case' });

export type Database = typeof db;
export { schema };
