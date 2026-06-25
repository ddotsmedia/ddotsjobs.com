import { z } from 'zod';

// Server-side env validation. Imported by server code only — never client.
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),
  REDIS_KEY_PREFIX: z.string().default('ddotsjobs:'),
  MEILISEARCH_URL: z.string().url(),
  MEILISEARCH_MASTER_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  GREEN_API_INSTANCE_ID: z.string().optional(),
  GREEN_API_TOKEN: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET: z.string().default('ddotsjobs-assets'),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_R2_PUBLIC_URL: z.string().url(),
});

// Validate lazily to avoid throwing at import time during the client bundle.
export const env = (() => {
  // During the browser bundle only NEXT_PUBLIC_* are inlined; skip server parse.
  if (typeof window !== 'undefined') {
    return publicSchema.parse({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
    }) as z.infer<typeof serverSchema> & z.infer<typeof publicSchema>;
  }
  return {
    ...serverSchema.parse(process.env),
    ...publicSchema.parse({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
    }),
  };
})();
