import { NextResponse } from 'next/server';
import { pool } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Svc = 'ok' | 'error';

async function checkDb(): Promise<Svc> {
  try {
    await pool.query('SELECT 1 FROM users LIMIT 1');
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkRedis(): Promise<Svc> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

async function checkMeili(): Promise<Svc> {
  try {
    const url = process.env.MEILISEARCH_URL ?? 'http://localhost:7700';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${url}/health`, { signal: controller.signal });
      return res.ok ? 'ok' : 'error';
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return 'error';
  }
}

export async function GET() {
  const [database, redisStatus, meilisearch] = await Promise.all([
    checkDb(),
    checkRedis(),
    checkMeili(),
  ]);

  const services = { database, redis: redisStatus, meilisearch };
  const degraded = Object.values(services).some((v) => v === 'error');

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? null,
      services,
      uptime: process.uptime(),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
