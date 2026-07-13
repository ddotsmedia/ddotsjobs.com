import { NextResponse } from 'next/server';
import { and, db, eq, tables } from '@ddotsjobs/db';
import { getFileBuffer } from '@ddotsjobs/storage';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Auth-gated download of a user's own data export. Never public — the bundle
// contains personal data, so it must not be served via /api/files.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await ctx.params;
  const [row] = await db
    .select({
      storageKey: tables.dataExportRequests.storageKey,
      status: tables.dataExportRequests.status,
      expiresAt: tables.dataExportRequests.expiresAt,
    })
    .from(tables.dataExportRequests)
    .where(and(eq(tables.dataExportRequests.id, id), eq(tables.dataExportRequests.userId, userId)))
    .limit(1);

  if (!row || row.status !== 'ready' || !row.storageKey) return new NextResponse('Not found', { status: 404 });
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return new NextResponse('Export expired', { status: 410 });

  try {
    const buf = await getFileBuffer(row.storageKey);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'content-type': 'application/gzip',
        'content-disposition': `attachment; filename="ddotsjobs-data-${id.slice(0, 8)}.json.gz"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
