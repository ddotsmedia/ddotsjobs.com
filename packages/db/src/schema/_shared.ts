import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** Postgres tsvector column (full-text search). Maintained by DB trigger. */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

/** pgvector column. Dimension fixed at the embedding model's width. */
export const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>(
  {
    dataType(config) {
      return `vector(${config?.dimensions ?? 1536})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      return value
        .slice(1, -1)
        .split(',')
        .filter((s) => s.length > 0)
        .map(Number);
    },
  },
);

/** Standard primary key — uuid v4 from pgcrypto's gen_random_uuid(). */
export const pk = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);

/** created_at / updated_at / deleted_at. updated_at maintained by DB trigger. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};
