// Public entry for @ddotsjobs/db.
export { db, pool, schema, type Database } from './client.js';
export * as tables from './schema/index.js';
export { createNotification, type CreateNotificationArgs } from './notifications.js';

// Drizzle query helpers re-exported for convenience at call sites.
export {
  and,
  asc,
  avg,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  isNotNull,
  lt,
  lte,
  ne,
  or,
  sql,
  sum,
} from 'drizzle-orm';

export type { SQL } from 'drizzle-orm';
