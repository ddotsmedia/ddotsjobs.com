import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, createNotification, desc, eq, gte, isNull, sql, tables, type Database } from '@ddotsjobs/db';
import { roleProcedure, router } from '../trpc.js';

const employerProc = roleProcedure('employer');

const DAILY_CONTACT_LIMIT = 10;

const DISTRICT_VALUES = [
  'thiruvananthapuram', 'kollam', 'pathanamthitta', 'alappuzha', 'kottayam', 'idukki',
  'ernakulam', 'thrissur', 'palakkad', 'malappuram', 'kozhikode', 'wayanad', 'kannur', 'kasaragod',
] as const;

/** Resolve the calling employer; require verified status (billing gates land in D7). */
async function requireVerifiedEmployer(db: Database, userId: string): Promise<{ id: string }> {
  const [row] = await db
    .select({ id: tables.employers.id, status: tables.employers.verificationStatus })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'FORBIDDEN', message: 'No employer profile' });
  if (row.status !== 'verified') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Talent pool access requires a verified employer account' });
  }
  return { id: row.id };
}

function firstNameOf(name: string | null): string {
  if (!name) return 'Candidate';
  return name.trim().split(/\s+/)[0] ?? 'Candidate';
}

function contactKey(employerId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `employer:contact:${employerId}:${date}`;
}

export const talentPoolRouter = router({
  contactQuota: employerProc.query(async ({ ctx }) => {
    const me = await requireVerifiedEmployer(ctx.db, ctx.user.id);
    const used = Number((await ctx.redis.get(contactKey(me.id))) ?? '0') || 0;
    return { used, limit: DAILY_CONTACT_LIMIT };
  }),

  search: employerProc
    .input(
      z.object({
        category: z.string().optional(),
        district: z.enum(DISTRICT_VALUES).optional(),
        minExperienceMonths: z.number().int().min(0).optional(),
        certType: z.string().optional(),
        isWalkIn: z.boolean().optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const me = await requireVerifiedEmployer(ctx.db, ctx.user.id);
      const u = tables.users;
      const sp = tables.seekerProfiles;

      const conds = [
        eq(u.role, 'seeker'),
        isNull(u.deletedAt),
        sql`${sp.visibility} <> 'private'`,
        eq(sp.isOpenToWork, true),
      ];
      if (input.district) conds.push(eq(sp.currentDistrict, input.district));
      if (input.minExperienceMonths != null) conds.push(gte(sp.totalExperienceMonths, input.minExperienceMonths));
      if (input.category) conds.push(sql`${sp.preferredCategories} ? ${input.category}`);
      if (input.certType) {
        conds.push(
          sql`exists (select 1 from professional_registrations pr where pr.user_id = ${u.id} and pr.type_code = ${input.certType} and pr.status = 'verified')`,
        );
      }
      if (input.cursor) {
        conds.push(
          sql`(${sp.completionPct}, ${u.createdAt}, ${u.id}) < (select sp2.completion_pct, u2.created_at, u2.id from users u2 join seeker_profiles sp2 on sp2.user_id = u2.id where u2.id = ${input.cursor})`,
        );
      }

      const rows = await ctx.db
        .select({
          id: u.id,
          firstName: u.nameEn,
          nameMl: u.nameMl,
          currentDistrict: sp.currentDistrict,
          totalExperienceMonths: sp.totalExperienceMonths,
          preferredCategories: sp.preferredCategories,
          completionPct: sp.completionPct,
          urgencyLevel: sp.urgencyLevel,
          isVerifiedProfessional: u.isVerifiedProfessional,
          hasVerifiedCert: sql<boolean>`exists (select 1 from professional_registrations pr where pr.user_id = ${u.id} and pr.status = 'verified')`,
          primaryCert: sql<string | null>`(select pr.type_code from professional_registrations pr where pr.user_id = ${u.id} and pr.status = 'verified' limit 1)`,
        })
        .from(u)
        .innerJoin(sp, eq(sp.userId, u.id))
        .where(and(...conds))
        .orderBy(desc(sp.completionPct), desc(u.createdAt), desc(u.id))
        .limit(input.limit);

      // Log profile views (deduped by the contacts unique index).
      if (rows.length > 0) {
        await ctx.db
          .insert(tables.employerSeekerContacts)
          .values(rows.map((r) => ({ employerId: me.id, seekerUserId: r.id, channel: 'profile_view' })))
          .onConflictDoNothing();
      }

      // Strip PII — first name only, never phone/email/last name.
      const items = rows.map((r) => ({
        id: r.id,
        firstName: firstNameOf(r.firstName),
        firstNameMl: firstNameOf(r.nameMl),
        district: r.currentDistrict,
        totalExperienceMonths: r.totalExperienceMonths ?? 0,
        preferredCategories: r.preferredCategories,
        completionPct: r.completionPct,
        urgencyLevel: r.urgencyLevel,
        isVerifiedProfessional: r.isVerifiedProfessional,
        hasVerifiedCert: r.hasVerifiedCert,
        primaryCert: r.primaryCert,
      }));
      const nextCursor = rows.length === input.limit ? (rows[rows.length - 1]?.id ?? null) : null;
      return { items, nextCursor };
    }),

  contactSeeker: employerProc
    .input(
      z.object({
        seekerId: z.string().uuid(),
        jobId: z.string().uuid().optional(),
        message: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = await requireVerifiedEmployer(ctx.db, ctx.user.id);

      // Daily rate limit (10/day per employer).
      const key = contactKey(me.id);
      const count = await ctx.redis.incr(key);
      if (count === 1) await ctx.redis.expire(key, 86_400);
      if (count > DAILY_CONTACT_LIMIT) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Daily contact limit reached (10/day)' });
      }

      // Seeker must be contactable.
      const [seeker] = await ctx.db
        .select({ visibility: tables.seekerProfiles.visibility })
        .from(tables.seekerProfiles)
        .where(eq(tables.seekerProfiles.userId, input.seekerId))
        .limit(1);
      if (!seeker || seeker.visibility === 'private') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Candidate is not contactable' });
      }

      // Verify job ownership when supplied.
      if (input.jobId) {
        const [owned] = await ctx.db
          .select({ id: tables.jobs.id })
          .from(tables.jobs)
          .where(and(eq(tables.jobs.id, input.jobId), eq(tables.jobs.employerId, me.id)))
          .limit(1);
        if (!owned) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });
      }

      await ctx.db.insert(tables.employerSeekerContacts).values({
        employerId: me.id,
        seekerUserId: input.seekerId,
        jobId: input.jobId ?? null,
        channel: 'whatsapp_initiated',
        note: input.message,
      });

      await createNotification({
        userId: input.seekerId,
        type: 'employer.contact',
        title: 'An employer wants to connect',
        titleMl: 'ഒരു employer connect ചെയ്യാൻ ആഗ്രഹിക്കുന്നു',
        body: input.message.slice(0, 100),
        actionUrl: '/seeker/dashboard',
      });

      return { success: true as const, used: count, limit: DAILY_CONTACT_LIMIT };
    }),
});
