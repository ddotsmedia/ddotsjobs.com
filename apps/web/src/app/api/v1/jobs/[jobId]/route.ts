import { NextResponse } from 'next/server';
import { guard, jsonError } from '@/lib/api-auth';
import { apiJobUpdateInput, updateJobViaApi, deleteJobViaApi } from '@/lib/api-jobs';

export const runtime = 'nodejs';

// PUT /api/v1/jobs/[jobId] — update a job.
export async function PUT(req: Request, ctx: { params: Promise<{ jobId: string }> }): Promise<NextResponse> {
  const g = await guard(req);
  if ('res' in g) return g.res;
  const { jobId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body.', 'bad_request');
  }
  const parsed = apiJobUpdateInput.safeParse(body);
  if (!parsed.success) return jsonError(422, parsed.error.issues[0]?.message ?? 'Validation failed', 'validation_error');
  const ok = await updateJobViaApi(g.auth.employerId, jobId, parsed.data);
  if (!ok) return jsonError(404, 'Job not found.', 'not_found');
  return NextResponse.json({ jobId, updated: true });
}

// DELETE /api/v1/jobs/[jobId] — soft-delete a job.
export async function DELETE(req: Request, ctx: { params: Promise<{ jobId: string }> }): Promise<NextResponse> {
  const g = await guard(req);
  if ('res' in g) return g.res;
  const { jobId } = await ctx.params;
  const ok = await deleteJobViaApi(g.auth.employerId, jobId);
  if (!ok) return jsonError(404, 'Job not found.', 'not_found');
  return NextResponse.json({ jobId, deleted: true });
}
