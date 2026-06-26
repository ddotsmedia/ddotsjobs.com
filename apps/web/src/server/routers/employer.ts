import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Resend } from 'resend';
import { and, eq, isNull, tables, type Database } from '@ddotsjobs/db';
import { uploadFile } from '@ddotsjobs/storage';
import { protectedProcedure, router } from '../trpc.js';

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
        legalNameEn: input.companyName,
        displayNameEn: input.companyName,
        displayNameMl: input.companyNameMl ?? null,
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
});
