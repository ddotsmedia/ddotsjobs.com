import { and, eq, sql, tables, type Database } from '@ddotsjobs/db';
import { getSetting } from '@/lib/site-settings';

// Award a referrer credits when their referred applicant applies. Best-effort:
// never let a referral failure block the application. Deduped per
// (referrer, applicant, job) so re-applies don't double-pay.
export async function awardReferralOnApply(db: Database, referralCode: string, applicantId: string, jobId: string): Promise<void> {
  try {
    const [link] = await db
      .select({ id: tables.referralLinks.id, userId: tables.referralLinks.userId })
      .from(tables.referralLinks)
      .where(eq(tables.referralLinks.referralCode, referralCode))
      .limit(1);
    if (!link || link.userId === applicantId) return; // no self-referral

    const rc = tables.referralCredits;
    const [dup] = await db
      .select({ id: rc.id })
      .from(rc)
      .where(and(eq(rc.userId, link.userId), eq(rc.transactionType, 'apply'), eq(rc.relatedUserId, applicantId), eq(rc.note, jobId)))
      .limit(1);
    if (dup) return;

    const points = Number(await getSetting('referral_points_apply', '10')) || 10;
    await db.insert(rc).values({ userId: link.userId, transactionType: 'apply', amount: points, relatedUserId: applicantId, note: jobId });
    await db
      .update(tables.referralLinks)
      .set({ applyCount: sql`${tables.referralLinks.applyCount} + 1` })
      .where(eq(tables.referralLinks.id, link.id));
  } catch {
    /* referral is best-effort */
  }
}
