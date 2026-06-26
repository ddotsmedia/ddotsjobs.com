import type { Job } from 'bullmq';
import { db, eq, sql, tables } from '@ddotsjobs/db';

interface DispatchPayload {
  dispatchLogId: string;
  subscriptionId: string;
  userId: string;
  phone: string;
  channel: string;
  language: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  district: string | null;
  salaryMinPaise: number | null;
  isWalkIn: boolean;
}

const BASE_URL = process.env.GREEN_API_BASE_URL ?? 'https://api.green-api.com';

function titleCase(s: string | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function buildMessage(p: DispatchPayload, slug: string): string {
  const district = titleCase(p.district);
  const salaryLine =
    p.salaryMinPaise != null
      ? `₹${Math.round(p.salaryMinPaise / 100).toLocaleString('en-IN')}/mo\n`
      : '';
  const walkLine = p.isWalkIn ? `📅 Walk-in available\n` : '';
  const url = `\n👉 ddotsjobs.com/jobs/${slug}\n\n`;

  if (p.language === 'ml') {
    return (
      `🔔 *നിങ്ങൾക്കായി ഒരു job*\n\n` +
      `*${p.jobTitle}*\n` +
      `${p.companyName} · ${district}\n` +
      salaryLine +
      walkLine +
      url +
      `STOP അയക്കുക alerts നിർത്താൻ`
    );
  }
  return (
    `🔔 *New job for you*\n\n` +
    `*${p.jobTitle}*\n` +
    `${p.companyName} · ${district}\n` +
    salaryLine +
    walkLine +
    url +
    `Reply STOP to unsubscribe`
  );
}

/** ddotsjobs:dispatch processor — routes by job.name. */
export async function dispatchQueueProcessor(job: Job): Promise<unknown> {
  if (job.name === 'whatsapp_job') return sendWhatsAppJob(job.data as DispatchPayload);
  // psc_alert (B4) dispatch lands in a later phase.
  console.log(`[dispatch] queued ${job.name}`);
  return { status: 'queued' };
}

async function sendWhatsAppJob(p: DispatchPayload): Promise<{ status: string }> {
  const [jobRow] = await db
    .select({ slug: tables.jobs.slug })
    .from(tables.jobs)
    .where(eq(tables.jobs.id, p.jobId))
    .limit(1);
  const slug = jobRow?.slug ?? p.jobId;
  const message = buildMessage(p, slug);

  const id = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;

  try {
    if (!id || !token) throw new Error('Green API credentials not set');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let messageId: string | undefined;
    try {
      const res = await fetch(`${BASE_URL}/waInstance${id}/sendMessage/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatId: `${p.phone.replace('+', '')}@c.us`, message }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Green API ${res.status}`);
      const data = (await res.json()) as { idMessage?: string };
      messageId = data.idMessage;
    } finally {
      clearTimeout(timer);
    }

    await db
      .update(tables.alertDispatchLog)
      .set({
        deliveryStatus: 'sent',
        whatsappMessageId: messageId ?? null,
        deliveryUpdatedAt: new Date(),
      })
      .where(eq(tables.alertDispatchLog.id, p.dispatchLogId));

    await db
      .update(tables.alertSubscriptions)
      .set({ totalSent: sql`${tables.alertSubscriptions.totalSent} + 1`, lastSentAt: new Date() })
      .where(eq(tables.alertSubscriptions.id, p.subscriptionId));

    return { status: 'sent' };
  } catch (err) {
    await db
      .update(tables.alertDispatchLog)
      .set({
        deliveryStatus: 'failed',
        failureReason: String(err).slice(0, 500),
        deliveryUpdatedAt: new Date(),
      })
      .where(eq(tables.alertDispatchLog.id, p.dispatchLogId));
    throw err; // let BullMQ retry; terminal failure keeps status 'failed'
  }
}
