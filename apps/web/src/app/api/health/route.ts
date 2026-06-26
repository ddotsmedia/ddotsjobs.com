import { NextResponse } from 'next/server';
import { pool } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ServiceResult {
  status: 'ok' | 'error';
  latencyMs?: number;
}

async function timed(fn: () => Promise<void>): Promise<ServiceResult> {
  const start = Date.now();
  try {
    await fn();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error', latencyMs: Date.now() - start };
  }
}

async function checkMeili(): Promise<ServiceResult> {
  try {
    const url = process.env.MEILISEARCH_URL ?? 'http://localhost:7700';
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    return { status: res.ok ? 'ok' : 'error' };
  } catch {
    return { status: 'error' };
  }
}

export async function GET() {
  const [db, redisRes, meili] = await Promise.allSettled([
    timed(async () => {
      await pool.query('SELECT 1');
    }),
    timed(async () => {
      await redis.ping();
    }),
    checkMeili(),
  ]);

  const settle = (r: PromiseSettledResult<ServiceResult>): ServiceResult =>
    r.status === 'fulfilled' ? r.value : { status: 'error' };

  const services = {
    database: settle(db),
    redis: settle(redisRes),
    meilisearch: settle(meili),
  };
  const degraded = Object.values(services).some((s) => s.status === 'error');

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
    },
    { status: 200, headers: { 'cache-control': 'no-store, no-cache' } },
  );
}
