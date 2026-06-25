// Raw-SQL migration runner. Applies *.sql files from /migrations in lexical
// order, recording each in a tracking table so re-runs are idempotent.
// Additive migrations only — this runner never rolls back or drops.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Client } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
// packages/db/src -> repo root /migrations
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'migrations');

// Migrations run against the DIRECT cluster URL (not PgBouncer) so DDL and
// session-level statements behave correctly.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required to run migrations');

async function main(): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS __migrations (
        id          TEXT PRIMARY KEY,
        checksum    TEXT NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');

      const { rows } = await client.query<{ checksum: string }>(
        'SELECT checksum FROM __migrations WHERE id = $1',
        [file],
      );

      if (rows.length > 0) {
        if (rows[0]!.checksum !== checksum) {
          throw new Error(
            `Migration ${file} already applied with a different checksum. ` +
              `Migrations are immutable — add a new migration instead of editing.`,
          );
        }
        console.log(`==> skip   ${file} (already applied)`);
        continue;
      }

      console.log(`==> apply  ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO __migrations (id, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('==> migrations complete');
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
