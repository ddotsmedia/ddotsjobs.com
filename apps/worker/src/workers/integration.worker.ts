import type { Job, Processor } from 'bullmq';
import { and, db, eq, tables } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';
import { decryptJson } from '@ddotsjobs/config/crypto';
import { logger } from '../lib/logger.js';
import type { JobPayloads } from '../queues.js';

type Payload = JobPayloads['integration'];
const DAILY_CAP = 100;

// ── Provider credential shapes (decrypted from integrations.access_token) ──
interface SlackCfg { webhookUrl: string }
interface ZapierCfg { webhookUrl: string }
interface AirtableCfg { token: string; baseId: string; tableName: string }
interface HubSpotCfg { token: string }

async function post(url: string, init: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

function summarize(event: string, data: Record<string, unknown>): string {
  if (event === 'job_posted') return `New job posted: ${data.title ?? 'a job'}${data.url ? ` — ${data.url}` : ''}`;
  if (event === 'application_received') return `New application from ${data.candidateName ?? 'a candidate'}`;
  if (event === 'offer_sent') return `Offer sent: ${data.position ?? ''} ${data.salary ? `(${data.salary})` : ''}`.trim();
  return `Event: ${event}`;
}

async function pushSlack(cfg: SlackCfg, event: string, data: Record<string, unknown>): Promise<void> {
  const res = await post(cfg.webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: `:briefcase: ddotsjobs — ${summarize(event, data)}` }),
  });
  if (!res.ok) throw new Error(`Slack responded ${res.status}`);
}

async function pushZapier(cfg: ZapierCfg, event: string, data: Record<string, unknown>): Promise<void> {
  const res = await post(cfg.webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Zapier responded ${res.status}`);
}

async function pushAirtable(cfg: AirtableCfg, event: string, data: Record<string, unknown>): Promise<void> {
  const url = `https://api.airtable.com/v0/${encodeURIComponent(cfg.baseId)}/${encodeURIComponent(cfg.tableName)}`;
  const fields: Record<string, unknown> = {
    Event: event,
    Summary: summarize(event, data),
    JobId: (data.jobId as string) ?? '',
    Details: JSON.stringify(data),
    CreatedAt: new Date().toISOString(),
  };
  const res = await post(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable responded ${res.status}`);
}

async function pushHubSpot(cfg: HubSpotCfg, event: string, data: Record<string, unknown>): Promise<void> {
  // Create a contact for candidate-bearing events; other events are a no-op success.
  if (event !== 'application_received' && event !== 'offer_sent') return;
  const name = String(data.candidateName ?? data.position ?? 'ddotsjobs applicant');
  const res = await post('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ properties: { firstname: name, hs_lead_status: 'NEW', jobtitle: String(data.position ?? '') } }),
  });
  // 409 = contact already exists — treat as success (idempotent).
  if (!res.ok && res.status !== 409) throw new Error(`HubSpot responded ${res.status}`);
}

async function dispatch(provider: string, cfg: unknown, event: string, data: Record<string, unknown>): Promise<void> {
  switch (provider) {
    case 'slack':
      return pushSlack(cfg as SlackCfg, event, data);
    case 'zapier':
      return pushZapier(cfg as ZapierCfg, event, data);
    case 'airtable':
      return pushAirtable(cfg as AirtableCfg, event, data);
    case 'hubspot':
      return pushHubSpot(cfg as HubSpotCfg, event, data);
    default:
      throw new Error(`Unsupported provider ${provider}`);
  }
}

export const integrationProcessor: Processor<Payload> = async (job: Job<Payload>) => {
  const { integrationId, event, data } = job.data;

  const [row] = await db
    .select({
      provider: tables.integrations.providerName,
      connected: tables.integrations.isConnected,
      token: tables.integrations.accessToken,
    })
    .from(tables.integrations)
    .where(eq(tables.integrations.id, integrationId))
    .limit(1);
  if (!row || !row.connected || !row.token) {
    logger.warn({ integrationId }, 'integration push skipped — not connected');
    return { skipped: true };
  }

  // Confirm this event is still enabled.
  const [evt] = await db
    .select({ enabled: tables.integrationEvents.isPushEnabled })
    .from(tables.integrationEvents)
    .where(and(eq(tables.integrationEvents.integrationId, integrationId), eq(tables.integrationEvents.eventType, event)))
    .limit(1);
  if (evt && !evt.enabled) return { skipped: true };

  // Per-integration daily rate cap.
  const day = new Date().toISOString().slice(0, 10);
  const rlKey = `integration:rl:${integrationId}:${day}`;
  const n = await redis.incr(rlKey);
  if (n === 1) await redis.expire(rlKey, 86_400);
  if (n > DAILY_CAP) {
    logger.warn({ integrationId, n }, 'integration daily rate cap hit — skipping');
    return { rateLimited: true };
  }

  try {
    const cfg = decryptJson<unknown>(row.token);
    await dispatch(row.provider, cfg, event, data);
    await db
      .update(tables.integrations)
      .set({ lastSyncedAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(tables.integrations.id, integrationId));
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message.slice(0, 500);
    // Persist the error only on the final attempt so transient failures don't mask.
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade + 1 >= attempts) {
      await db
        .update(tables.integrations)
        .set({ lastError: msg, updatedAt: new Date() })
        .where(eq(tables.integrations.id, integrationId))
        .catch(() => {});
    }
    throw err;
  }
};
