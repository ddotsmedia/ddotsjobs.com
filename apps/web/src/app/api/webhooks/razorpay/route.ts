import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, db, eq, tables } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Razorpay webhook. Always returns 200 (Razorpay retries on non-200).
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) return NextResponse.json({ received: true, note: 'webhook secret unset' });

  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (expected !== signature) {
    // Bad signature — acknowledge without acting (do not let Razorpay retry-storm).
    return NextResponse.json({ received: true, verified: false });
  }

  let event: { event?: string; payload?: Record<string, unknown> };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ received: true, parsed: false });
  }

  try {
    if (event.event === 'payment.captured') {
      // Replay-attack prevention: process each payment id at most once.
      const pid = (event.payload as { payment?: { entity?: { id?: string } } } | undefined)?.payment?.entity?.id;
      if (pid) {
        const seenKey = `webhook:seen:${pid}`;
        const fresh = await redis.set(seenKey, '1', 'EX', 86_400, 'NX');
        if (fresh === null) return NextResponse.json({ received: true, duplicate: true });
      }
      await db.insert(tables.auditLog).values({
        action: 'razorpay.payment_captured',
        entityType: 'payment',
        diff: { payload: event.payload ?? {} },
      });
    } else if (event.event === 'subscription.cancelled') {
      const sub = (event.payload as { subscription?: { entity?: { id?: string } } } | undefined)?.subscription?.entity;
      const rzSubId = sub?.id;
      if (rzSubId) {
        const [row] = await db
          .select({ id: tables.subscriptions.id, employerId: tables.subscriptions.employerId })
          .from(tables.subscriptions)
          .where(eq(tables.subscriptions.razorpaySubscriptionId, rzSubId))
          .limit(1);
        if (row) {
          await db
            .update(tables.subscriptions)
            .set({ status: 'cancelled', cancelledAt: new Date() })
            .where(eq(tables.subscriptions.id, row.id));
          if (row.employerId) {
            await db
              .update(tables.employers)
              .set({ subscriptionTier: 'free', jobsLimitThisPeriod: 3 })
              .where(and(eq(tables.employers.id, row.employerId)));
          }
        }
      }
    }
  } catch {
    // Swallow — never make Razorpay retry; we already verified the signature.
  }

  return NextResponse.json({ received: true });
}
