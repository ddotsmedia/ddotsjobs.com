import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Resend } from 'resend';
import { and, asc, desc, eq, isNull, sql, tables, type Database } from '@ddotsjobs/db';
import { uploadFile } from '@ddotsjobs/storage';
import { protectedProcedure, router } from '../trpc.js';
import { stripHtml } from '@/lib/sanitize';

const DISTRICTS = [
  'thiruvananthapuram', 'kollam', 'pathanamthitta', 'alappuzha', 'kottayam',
  'idukki', 'ernakulam', 'thrissur', 'palakkad', 'malappuram', 'kozhikode',
  'wayanad', 'kannur', 'kasaragod',
] as const;

const EMPLOYER_TYPES = [
  'hospital', 'clinic', 'it_company', 'school', 'college', 'cooperative',
  'government', 'manufacturing', 'retail', 'construction', 'hospitality', 'ngo', 'other',
] as const;

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Map spec employer type -> employer_type enum (NOT NULL).
function typeEnum(code: string): 'direct' | 'government' | 'consultancy' | 'gulf_agency' | 'staffing' {
  if (code === 'government') return 'government';
  return 'direct';
}

const registerInput = z.object({
  companyName: z.string().min(2).max(255),
  companyNameMl: z.string().max(255).optional(),
  employerType: z.enum(EMPLOYER_TYPES),
  district: z.enum(DISTRICTS),
  gstNumber: z.string().regex(GST_RE).optional(),
  contactName: z.string().min(2).max(255),
  contactPhone: z.string().regex(/^\+91[6-9]\d{9}$/),
  websiteUrl: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  employeeCountRange: z.enum(['1-10', '11-50', '51-200', '200+']).optional(),
});

const IMG_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'company';
}

async function adminEmail(company: string, slug: string): Promise<void> {
  const to = process.env.ADMIN_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) {
    console.log(`[employer] New registration: ${company} (review /admin) — ADMIN_EMAIL/RESEND not set`);
    return;
  }
  try {
    await new Resend(key).emails.send({
      from: process.env.OTP_FROM ?? 'ddotsjobs <noreply@ddotsjobs.com>',
      to,
      subject: `New employer registration: ${company}`,
      text: `${company} just registered. Review: https://ddotsjobs.com/admin (slug: ${slug})`,
    });
  } catch (err) {
    console.warn(`[employer] admin email failed: ${String(err)}`);
  }
}

async function ownEmployer(db: Database, userId: string) {
  const [row] = await db
    .select({ id: tables.employers.id })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  return row ?? null;
}

export const employerRouter = router({
  register: protectedProcedure.input(registerInput).mutation(async ({ ctx, input }) => {
    if (await ownEmployer(ctx.db, ctx.user.id)) {
      throw new TRPCError({ code: 'CONFLICT', message: 'You already have an employer account' });
    }

    // Unique slug.
    let slug = slugify(input.companyName);
    const [taken] = await ctx.db
      .select({ id: tables.employers.id })
      .from(tables.employers)
      .where(eq(tables.employers.slug, slug))
      .limit(1);
    if (taken) slug = `${slug}-${randomBytes(2).toString('hex')}`;

    const [row] = await ctx.db
      .insert(tables.employers)
      .values({
        ownerUserId: ctx.user.id,
        slug,
        type: typeEnum(input.employerType),
        employerTypeCode: input.employerType,
        legalNameEn: stripHtml(input.companyName),
        displayNameEn: stripHtml(input.companyName),
        displayNameMl: input.companyNameMl ? stripHtml(input.companyNameMl) : null,
        district: input.district,
        gstin: input.gstNumber ?? null,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        websiteUrl: input.websiteUrl ?? null,
        descriptionEn: input.description ?? null,
        employeeCountRange: input.employeeCountRange ?? null,
        verificationStatus: 'unverified',
        subscriptionTier: 'free',
        jobsPostedThisPeriod: 0,
        jobsLimitThisPeriod: 3,
      })
      .returning({ id: tables.employers.id });
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    await ctx.db.update(tables.users).set({ role: 'employer' }).where(eq(tables.users.id, ctx.user.id));
    await adminEmail(input.companyName, slug);

    return { employerId: row.id, slug };
  }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const e = tables.employers;
    const [row] = await ctx.db
      .select({
        id: e.id,
        slug: e.slug,
        companyName: e.displayNameEn,
        companyNameMl: e.displayNameMl,
        employerType: e.employerTypeCode,
        district: e.district,
        gstNumber: e.gstin,
        contactName: e.contactName,
        contactPhone: e.contactPhone,
        websiteUrl: e.websiteUrl,
        description: e.descriptionEn,
        employeeCountRange: e.employeeCountRange,
        logoR2Key: e.logoR2Key,
        verificationStatus: e.verificationStatus,
        subscriptionTier: e.subscriptionTier,
        jobsPostedThisPeriod: e.jobsPostedThisPeriod,
        jobsLimitThisPeriod: e.jobsLimitThisPeriod,
        phone: tables.users.phone,
        email: tables.users.email,
      })
      .from(e)
      .innerJoin(tables.users, eq(tables.users.id, e.ownerUserId))
      .where(and(eq(e.ownerUserId, ctx.user.id), isNull(e.deletedAt)))
      .limit(1);
    if (!row) return null;
    const logoUrl = row.logoR2Key
      ? process.env.CLOUDFLARE_R2_ACCOUNT_ID
        ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''}/${row.logoR2Key}`
        : `/api/files/${row.logoR2Key}`
      : null;
    return { ...row, logoUrl };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        companyNameMl: z.string().max(255).optional(),
        employerType: z.enum(EMPLOYER_TYPES).optional(),
        district: z.enum(DISTRICTS).optional(),
        gstNumber: z.string().regex(GST_RE).optional(),
        contactName: z.string().min(2).max(255).optional(),
        contactPhone: z.string().regex(/^\+91[6-9]\d{9}$/).optional(),
        websiteUrl: z.string().url().optional(),
        description: z.string().max(1000).optional(),
        employeeCountRange: z.enum(['1-10', '11-50', '51-200', '200+']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const set: Record<string, unknown> = {};
      if (input.companyNameMl !== undefined) set.displayNameMl = input.companyNameMl;
      if (input.employerType !== undefined) {
        set.employerTypeCode = input.employerType;
        set.type = typeEnum(input.employerType);
      }
      if (input.district !== undefined) set.district = input.district;
      if (input.gstNumber !== undefined) set.gstin = input.gstNumber;
      if (input.contactName !== undefined) set.contactName = input.contactName;
      if (input.contactPhone !== undefined) set.contactPhone = input.contactPhone;
      if (input.websiteUrl !== undefined) set.websiteUrl = input.websiteUrl;
      if (input.description !== undefined) set.descriptionEn = input.description;
      if (input.employeeCountRange !== undefined) set.employeeCountRange = input.employeeCountRange;
      if (Object.keys(set).length > 0) {
        set.updatedAt = new Date();
        await ctx.db
          .update(tables.employers)
          .set(set)
          .where(and(eq(tables.employers.ownerUserId, ctx.user.id), isNull(tables.employers.deletedAt)));
      }
      return { success: true as const };
    }),

  uploadLogo: protectedProcedure
    .input(
      z.object({
        logoBase64: z.string().min(1),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const emp = await ownEmployer(ctx.db, ctx.user.id);
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'No employer account' });

      const b64 = input.logoBase64.replace(/^data:[^;]+;base64,/, '');
      const buf = Buffer.from(b64, 'base64');
      if (buf.byteLength === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empty image' });
      if (buf.byteLength > 2 * 1024 * 1024) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Logo exceeds 2MB' });

      const ext = IMG_EXT[input.mimeType] ?? 'png';
      const key = `logos/${emp.id}.${ext}`;
      const url = await uploadFile(key, buf, input.mimeType);
      await ctx.db.update(tables.employers).set({ logoR2Key: key }).where(eq(tables.employers.id, emp.id));
      return { logoUrl: url };
    }),

  // ── Analytics (Phase 2.4) ────────────────────────────────────────────
  // Aggregated dashboard metrics for the logged-in employer. Views/profile
  // views come from analytics_events (time-series, added 0030); applies from
  // the applications table (authoritative). Per-job columns use the lifetime
  // jobs.view_count / jobs.application_count counters.
  getAnalyticsDashboard: protectedProcedure
    .input(
      z
        .object({
          range: z.enum(['7d', '30d', 'all', 'custom']).default('7d'),
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const emp = await ownEmployer(ctx.db, ctx.user.id);
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'No employer account' });

      const j = tables.jobs;
      const ae = tables.analyticsEvents;
      const app = tables.applications;

      const range = input?.range ?? '7d';
      const DAY = 86_400_000;
      const now = new Date();
      // Current window [curStart, curEnd) and the immediately-preceding window
      // of equal length [prevStart, prevEnd) for trend comparison. "all" (or a
      // custom range missing from/to) has no bounds and no trend.
      let curStart: Date | null = null;
      let curEnd: Date | null = null;
      let prevStart: Date | null = null;
      let prevEnd: Date | null = null;
      if (range === '7d' || range === '30d') {
        const len = (range === '7d' ? 7 : 30) * DAY;
        curEnd = now;
        curStart = new Date(now.getTime() - len);
        prevEnd = curStart;
        prevStart = new Date(curStart.getTime() - len);
      } else if (range === 'custom' && input?.from && input?.to) {
        curStart = new Date(`${input.from}T00:00:00.000Z`);
        curEnd = new Date(`${input.to}T23:59:59.999Z`);
        const len = Math.max(DAY, curEnd.getTime() - curStart.getTime());
        prevEnd = curStart;
        prevStart = new Date(curStart.getTime() - len);
      }

      const windowConds = (col: typeof ae.createdAt | typeof app.createdAt, start: Date | null, end: Date | null) => {
        const c = [];
        if (start) c.push(sql`${col} >= ${start}`);
        if (end) c.push(sql`${col} < ${end}`);
        return c;
      };
      const countViews = async (start: Date | null, end: Date | null): Promise<number> => {
        const [r] = await ctx.db
          .select({ total: sql<number>`count(*)::int` })
          .from(ae)
          .where(and(eq(ae.employerId, emp.id), sql`${ae.eventType} in ('job_view','profile_view')`, ...windowConds(ae.createdAt, start, end)));
        return r?.total ?? 0;
      };
      const countApps = async (start: Date | null, end: Date | null): Promise<number> => {
        const [r] = await ctx.db
          .select({ total: sql<number>`count(*)::int` })
          .from(app)
          .where(and(eq(app.employerId, emp.id), isNull(app.withdrawnAt), ...windowConds(app.createdAt, start, end)));
        return r?.total ?? 0;
      };

      // Job status counts (lifetime, non-deleted).
      const [counts] = await ctx.db
        .select({
          totalJobsPosted: sql<number>`count(*)::int`,
          activeJobs: sql<number>`count(*) filter (where ${j.status} = 'active')::int`,
          expiredJobs: sql<number>`count(*) filter (where ${j.status} in ('expired','closed','filled'))::int`,
        })
        .from(j)
        .where(and(eq(j.employerId, emp.id), isNull(j.deletedAt)));

      const hasPrev = prevStart != null;
      const [totalViews, totalApplications, prevViews, prevApplications] = await Promise.all([
        countViews(curStart, curEnd),
        countApps(curStart, curEnd),
        hasPrev ? countViews(prevStart, prevEnd) : Promise.resolve(0),
        hasPrev ? countApps(prevStart, prevEnd) : Promise.resolve(0),
      ]);

      // Per-job breakdown (lifetime counters).
      const jobRows = await ctx.db
        .select({
          jobId: j.id,
          title: j.titleEn,
          slug: j.slug,
          status: j.status,
          views: j.viewCount,
          applies: j.applicationCount,
          updatedAt: j.updatedAt,
        })
        .from(j)
        .where(and(eq(j.employerId, emp.id), isNull(j.deletedAt)))
        .orderBy(desc(j.viewCount));

      // Chart window: current window, or last 30d for "all".
      const chartStart = curStart ?? new Date(now.getTime() - 30 * DAY);
      const applicationsByDate = await ctx.db
        .select({
          date: sql<string>`to_char(date(${app.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(app)
        .where(and(eq(app.employerId, emp.id), isNull(app.withdrawnAt), ...windowConds(app.createdAt, chartStart, curEnd)))
        .groupBy(sql`date(${app.createdAt})`)
        .orderBy(asc(sql`date(${app.createdAt})`));

      const viewsByDate = await ctx.db
        .select({
          date: sql<string>`to_char(date(${ae.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(ae)
        .where(and(eq(ae.employerId, emp.id), sql`${ae.eventType} = 'job_view'`, ...windowConds(ae.createdAt, chartStart, curEnd)))
        .groupBy(sql`date(${ae.createdAt})`)
        .orderBy(asc(sql`date(${ae.createdAt})`));

      const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
      // % change vs previous period; null when no comparable prior data.
      const changePct = (cur: number, prev: number): number | null =>
        !hasPrev || prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
      const conversionRate = pct(totalApplications, totalViews);
      const prevConversion = pct(prevApplications, prevViews);

      const viewsPerJob = jobRows.map((r) => ({
        jobId: r.jobId,
        title: r.title,
        slug: r.slug,
        status: r.status,
        views: r.views,
        applies: r.applies,
        conversion: pct(r.applies, r.views),
        updatedAt: r.updatedAt,
      }));
      const topPerformingJobs = [...viewsPerJob]
        .filter((r) => r.views >= 5)
        .sort((a, b) => b.conversion - a.conversion)
        .slice(0, 3);

      return {
        range,
        from: input?.from ?? null,
        to: input?.to ?? null,
        kpis: {
          totalJobsPosted: counts?.totalJobsPosted ?? 0,
          activeJobs: counts?.activeJobs ?? 0,
          expiredJobs: counts?.expiredJobs ?? 0,
          totalViews,
          totalApplications,
          conversionRate,
        },
        // Trends vs previous same-length period. views/applications = % change;
        // conversion = percentage-point delta. null = no prior data to compare.
        trends: {
          views: changePct(totalViews, prevViews),
          applications: changePct(totalApplications, prevApplications),
          conversion: hasPrev && prevViews > 0 ? Math.round((conversionRate - prevConversion) * 10) / 10 : null,
        },
        viewsPerJob,
        topPerformingJobs,
        applicationsByDate,
        viewsByDate,
      };
    }),

  // Single-job analytics: metrics, 30-day timeline, applicant list.
  getJobAnalytics: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const emp = await ownEmployer(ctx.db, ctx.user.id);
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'No employer account' });

      const j = tables.jobs;
      const [job] = await ctx.db
        .select({
          id: j.id,
          title: j.titleEn,
          slug: j.slug,
          status: j.status,
          employerId: j.employerId,
          views: j.viewCount,
          applies: j.applicationCount,
        })
        .from(j)
        .where(and(eq(j.id, input.jobId), isNull(j.deletedAt)))
        .limit(1);
      // Ownership check — never leak another employer's job.
      if (!job || job.employerId !== emp.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      }

      const ae = tables.analyticsEvents;
      const app = tables.applications;
      const chartSince = sql`now() - make_interval(days => 30)`;

      const [cta] = await ctx.db
        .select({ clicks: sql<number>`count(*)::int` })
        .from(ae)
        .where(and(eq(ae.jobId, job.id), sql`${ae.eventType} = 'apply_cta_click'`));

      const viewsByDate = await ctx.db
        .select({
          date: sql<string>`to_char(date(${ae.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(ae)
        .where(and(eq(ae.jobId, job.id), sql`${ae.eventType} = 'job_view'`, sql`${ae.createdAt} >= ${chartSince}`))
        .groupBy(sql`date(${ae.createdAt})`)
        .orderBy(asc(sql`date(${ae.createdAt})`));

      const appsByDate = await ctx.db
        .select({
          date: sql<string>`to_char(date(${app.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(app)
        .where(and(eq(app.jobId, job.id), isNull(app.withdrawnAt), sql`${app.createdAt} >= ${chartSince}`))
        .groupBy(sql`date(${app.createdAt})`)
        .orderBy(asc(sql`date(${app.createdAt})`));

      // Merge views + applies into one daily timeline.
      const map = new Map<string, { date: string; views: number; applies: number }>();
      for (const r of viewsByDate) map.set(r.date, { date: r.date, views: r.count, applies: 0 });
      for (const r of appsByDate) {
        const e = map.get(r.date) ?? { date: r.date, views: 0, applies: 0 };
        e.applies = r.count;
        map.set(r.date, e);
      }
      const timeline = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));

      const applicants = await ctx.db
        .select({
          id: app.id,
          name: tables.users.nameEn,
          appliedAt: app.createdAt,
          status: app.statusCode,
        })
        .from(app)
        .innerJoin(tables.users, eq(tables.users.id, app.seekerUserId))
        .where(and(eq(app.jobId, job.id), isNull(app.withdrawnAt)))
        .orderBy(desc(app.createdAt))
        .limit(50);

      const conversion = job.views > 0 ? Math.round((job.applies / job.views) * 1000) / 10 : 0;
      return {
        job: {
          id: job.id,
          title: job.title,
          slug: job.slug,
          status: job.status,
          views: job.views,
          applies: job.applies,
          ctaClicks: cta?.clicks ?? 0,
          conversion,
        },
        timeline,
        applicants,
      };
    }),
});
