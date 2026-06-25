import { defineConfig } from 'drizzle-kit';

// Direct (unpooled) connection for schema introspection / generation.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required for drizzle-kit');

export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/db/src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
