import { NextResponse } from 'next/server';
import { db, eq, tables } from '@ddotsjobs/db';
import { guard } from '@/lib/api-auth';

export const runtime = 'nodejs';

// GET /api/v1/me — the authenticated employer.
export async function GET(req: Request): Promise<NextResponse> {
  const g = await guard(req);
  if ('res' in g) return g.res;
  const [emp] = await db
    .select({
      id: tables.employers.id,
      name: tables.employers.displayNameEn,
      slug: tables.employers.slug,
      verificationStatus: tables.employers.verificationStatus,
      jobsPosted: tables.employers.jobsPostedThisPeriod,
      jobsLimit: tables.employers.jobsLimitThisPeriod,
    })
    .from(tables.employers)
    .where(eq(tables.employers.id, g.auth.employerId))
    .limit(1);
  if (!emp) return NextResponse.json({ error: { code: 'not_found', message: 'Employer not found' } }, { status: 404 });
  return NextResponse.json({
    employerId: emp.id,
    name: emp.name,
    slug: emp.slug,
    verified: emp.verificationStatus === 'verified',
    jobsPostedThisPeriod: emp.jobsPosted,
    jobsLimitThisPeriod: emp.jobsLimit,
  });
}
