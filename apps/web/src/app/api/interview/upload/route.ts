import { NextResponse } from 'next/server';
import { and, db, eq, tables } from '@ddotsjobs/db';
import { uploadFile } from '@ddotsjobs/storage';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB per answer

// Candidate uploads one recorded answer (multipart, not tRPC — video blobs are
// too large for JSON base64). Stores via the shared storage layer (R2 or local
// fallback) and upserts the interview_videos row.
export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const interviewId = String(form.get('interviewId') ?? '');
  const questionId = String(form.get('questionId') ?? '');
  const file = form.get('file');
  const durationRaw = form.get('duration');
  if (!interviewId || !questionId || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'video too large (max 30MB)' }, { status: 413 });

  // Verify this interview belongs to the caller and the question belongs to it.
  const vi = tables.videoInterviews;
  const [iv] = await db.select({ candidateId: vi.candidateId, status: vi.status }).from(vi).where(eq(vi.id, interviewId)).limit(1);
  if (!iv || iv.candidateId !== session.user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const [q] = await db
    .select({ id: tables.interviewQuestions.id })
    .from(tables.interviewQuestions)
    .where(and(eq(tables.interviewQuestions.id, questionId), eq(tables.interviewQuestions.interviewId, interviewId)))
    .limit(1);
  if (!q) return NextResponse.json({ error: 'bad question' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || 'video/webm';
  const ext = contentType.includes('mp4') ? 'mp4' : 'webm';
  const key = `interviews/${interviewId}/${questionId}.${ext}`;
  const storagePath = await uploadFile(key, buffer, contentType);

  const duration = durationRaw ? Math.max(0, Math.round(Number(durationRaw))) || null : null;
  const iviTable = tables.interviewVideos;
  await db
    .insert(iviTable)
    .values({ interviewId, questionId, storagePath, duration })
    .onConflictDoUpdate({ target: [iviTable.interviewId, iviTable.questionId], set: { storagePath, duration, uploadedAt: new Date() } });

  // First upload flips the interview into "recording".
  if (iv.status === 'scheduled') {
    await db.update(vi).set({ status: 'recording' }).where(eq(vi.id, interviewId));
  }

  return NextResponse.json({ ok: true, path: storagePath });
}
