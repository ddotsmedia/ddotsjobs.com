import { NextResponse } from 'next/server';
import { getFileBuffer } from '@ddotsjobs/storage';

export const runtime = 'nodejs';

// Local-fallback file server (used only when R2 is not configured). Serves
// uploaded documents from /tmp/ddotsjobs-uploads.
const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webm: 'video/webm',
  mp4: 'video/mp4',
};

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const path = key.join('/');
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const contentType = TYPES[ext] ?? 'application/octet-stream';

  try {
    const buf = await getFileBuffer(path);
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'content-type': contentType, 'cache-control': 'private, max-age=300' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
