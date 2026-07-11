import { NextResponse } from 'next/server';
import { and, db, desc, eq, isNull, tables } from '@ddotsjobs/db';
import { guard, jsonError, apiRateLimit } from '@/lib/api-auth';
import { apiJobInput, createJobViaApi } from '@/lib/api-jobs';

export const runtime = 'nodejs';

// POST /api/v1/jobs — create a job.
export async function POST(req: Request): Promise<NextResponse> {
  const g = await guard(req);
  if ('res' in g) return g.res;
  if (!(await apiRateLimit(g.auth.keyId, 'post', 100, 86_400))) {
    return jsonError(429, 'Daily job-post limit reached (100/day).', 'rate_limited');
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body.', 'bad_request');
  }
  const parsed = apiJobInput.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, parsed.error.issues[0]?.message ?? 'Validation failed', 'validation_error');
  }
  const r = await createJobViaApi(g.auth.employerId, g.auth.ownerUserId, parsed.data);
  if (!r.ok) return jsonError(r.status, r.message);
  return NextResponse.json({ jobId: r.jobId, status: r.status, url: `https://ddotsjobs.com/jobs/${r.slug}` }, { status: 201 });
}

// GET /api/v1/jobs — list the employer's jobs.
export async function GET(req: Request): Promise<NextResponse> {
  const g = await guard(req);
  if ('res' in g) return g.res;
  const jobs = await db
    .select({ jobId: tables.jobs.id, title: tables.jobs.titleEn, status: tables.jobs.status, slug: tables.jobs.slug, createdAt: tables.jobs.createdAt })
    .from(tables.jobs)
    .where(and(eq(tables.jobs.employerId, g.auth.employerId), isNull(tables.jobs.deletedAt)))
    .orderBy(desc(tables.jobs.createdAt))
    .limit(100);
  return NextResponse.json({ jobs: jobs.map((j) => ({ ...j, url: `https://ddotsjobs.com/jobs/${j.slug ?? j.jobId}` })) });
}
