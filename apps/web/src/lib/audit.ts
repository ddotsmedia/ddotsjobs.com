import { tables, type Database } from '@ddotsjobs/db';

interface LogCtx {
  db: Database;
  headers?: Headers;
  user?: { id: string };
}

// Append an entry to the shared audit_log. Best-effort — never throws into the
// caller (a failed audit write must not break the user action).
export async function logAction(
  ctx: LogCtx,
  action: string,
  entityType: string,
  entityId?: string,
  diff?: Record<string, unknown>,
  actorUserId?: string,
): Promise<void> {
  try {
    const fwd = ctx.headers?.get('x-forwarded-for');
    const ip = fwd ? fwd.split(',')[0]?.trim() ?? null : (ctx.headers?.get('x-real-ip') ?? null);
    const ua = ctx.headers?.get('user-agent') ?? null;
    await ctx.db.insert(tables.auditLog).values({
      actorUserId: actorUserId ?? ctx.user?.id ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      diff: diff ?? {},
      ipAddress: ip ? ip.slice(0, 64) : null,
      userAgent: ua ? ua.slice(0, 500) : null,
    });
  } catch {
    // swallow — auditing is advisory
  }
}
