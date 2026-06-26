import { callAI } from '@ddotsjobs/ai';
import { knmcExtractCertificatePrompt } from '@ddotsjobs/ai/prompts';
import { db, eq, tables } from '@ddotsjobs/db';
import { getFileBuffer } from '@ddotsjobs/storage';
import { Resend } from 'resend';

export interface KnmcJob {
  registrationId: string;
  userId: string;
  type: string;
  registrationNumber: string;
}

// status_code -> verification_status enum (NOT NULL on the row).
const STATUS_ENUM: Record<string, 'verified' | 'rejected' | 'pending'> = {
  verified: 'verified',
  failed: 'rejected',
  manual_review: 'pending',
};

function normalizeReg(s: string): string {
  return s.toLowerCase().replace(/[\s\-/]/g, '');
}

function isImageKey(key: string): boolean {
  return /\.(jpg|jpeg|png)$/i.test(key);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
    }
    const text = parts.join('\n').trim();
    return text.length > 0 ? text : 'Document text empty - manual review';
  } catch (err) {
    console.warn(`[knmc] pdf extract failed: ${String(err)}`);
    return 'Document could not be parsed - manual review';
  }
}

async function emailResult(userId: string, type: string, status: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const [user] = await db
    .select({ email: tables.users.email })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .limit(1);
  if (!user?.email) {
    console.log('[knmc] No email for user, skipping');
    return;
  }
  const body =
    status === 'verified'
      ? `Your ${type} credential is verified. A verified badge now shows on your ddotsjobs.com profile.`
      : status === 'failed'
        ? `We could not verify your ${type} credential. Please re-check the number and document, then try again.`
        : `Your ${type} credential is under manual review. Our team will update you within 24 hours.`;
  try {
    await new Resend(key).emails.send({
      from: process.env.OTP_FROM ?? 'ddotsjobs <noreply@ddotsjobs.com>',
      to: user.email,
      subject: `Your ${type} verification result`,
      text: body,
    });
  } catch (err) {
    console.warn(`[knmc] email failed: ${String(err)}`);
  }
}

export async function runKnmcVerify(raw: unknown): Promise<{ status: string }> {
  const data = raw as KnmcJob;
  const t = tables.professionalRegistrations;

  const [reg] = await db
    .select({ key: t.documentR2Key })
    .from(t)
    .where(eq(t.id, data.registrationId))
    .limit(1);
  if (!reg?.key) return { status: 'skipped' };

  const buffer = await getFileBuffer(reg.key);
  const pdfText = isImageKey(reg.key) ? 'Image document - manual review' : await extractPdfText(buffer);

  const spec = knmcExtractCertificatePrompt({ pdfText });
  const result = await callAI({
    task: spec.task,
    prompt: spec.prompt,
    system: spec.system,
    schema: spec.schema,
  });
  const ex = result.data;

  let status: 'verified' | 'failed' | 'manual_review';
  let note: string | null = null;
  if (ex.is_valid_format && ex.confidence >= 0.75) {
    const a = ex.registration_number ? normalizeReg(ex.registration_number) : '';
    const b = normalizeReg(data.registrationNumber);
    if (a && a === b) {
      status = 'verified';
    } else {
      status = 'failed';
      note = 'Registration number mismatch';
    }
  } else if (ex.confidence < 0.4) {
    status = 'failed';
    note = 'Document not recognized';
  } else {
    status = 'manual_review';
    note = 'Low confidence - needs manual check';
  }

  await db
    .update(t)
    .set({
      status: STATUS_ENUM[status],
      statusCode: status,
      verifiedAt: status === 'verified' ? new Date() : null,
      verificationMethod: 'pdf_ai',
      aiExtractedData: ex as Record<string, unknown>,
      aiConfidenceScore: ex.confidence,
      aiExtractionModel: result.model,
      verifierNotes: note,
    })
    .where(eq(t.id, data.registrationId));

  if (status === 'verified') {
    await db.update(tables.users).set({ isVerifiedProfessional: true }).where(eq(tables.users.id, data.userId));
  }

  await emailResult(data.userId, data.type, status);
  return { status };
}
