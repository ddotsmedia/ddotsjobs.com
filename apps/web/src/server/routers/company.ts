import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, ilike, isNull, sql, tables, type Database } from '@ddotsjobs/db';
import { uploadFile } from '@ddotsjobs/storage';
import { publicProcedure, roleProcedure, router } from '../trpc.js';
import { cached, invalidate, TTL } from '@/lib/cache';

const emp = roleProcedure('employer');
const IMG_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTOS = 20;

async function ownEmployer(db: Database, userId: string) {
  const [row] = await db
    .select({ id: tables.employers.id, logoR2Key: tables.employers.logoR2Key })
    .from(tables.employers)
    .where(and(eq(tables.employers.ownerUserId, userId), isNull(tables.employers.deletedAt)))
    .limit(1);
  return row ?? null;
}

// Bust the 24h branding cache for an employer after any branding edit.
async function invalidateBranding(db: Database, employerId: string): Promise<void> {
  const [row] = await db.select({ slug: tables.employers.slug }).from(tables.employers).where(eq(tables.employers.id, employerId)).limit(1);
  if (row?.slug) await invalidate('branding', row.slug);
}

function keyToUrl(key: string | null): string | null {
  if (!key) return null;
  if (key.startsWith('http') || key.startsWith('/api/')) return key; // already a URL/path
  return process.env.CLOUDFLARE_R2_ACCOUNT_ID
    ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''}/${key}`
    : `/api/files/${key}`;
}

async function storeImage(empId: string, kind: string, base64: string, mime: keyof typeof IMG_EXT): Promise<string> {
  const b64 = base64.replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(b64, 'base64');
  if (buf.byteLength === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empty image' });
  if (buf.byteLength > 3 * 1024 * 1024) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Image exceeds 3MB' });
  const ext = IMG_EXT[mime] ?? 'jpg';
  const key = `company/${empId}/${kind}-${randomBytes(4).toString('hex')}.${ext}`;
  return uploadFile(key, buf, mime);
}

export const companyRouter = router({
  // Public enriched company profile by slug (branding + media + stories + jobs).
  getPublicProfile: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Employer branding is read-heavy and changes rarely — cache 24h, busted by
      // the branding mutations below (invalidateBranding).
      return cached('branding', input.slug, TTL.employerBranding, async () => {
        const e = tables.employers;
        const [row] = await ctx.db
          .select({
            id: e.id,
            slug: e.slug,
            name: e.displayNameEn,
            nameMl: e.displayNameMl,
            type: e.employerTypeCode,
            district: e.district,
            website: e.websiteUrl,
            logoR2Key: e.logoR2Key,
            bio: e.companyDescription,
            description: e.descriptionEn,
            founded: e.yearEstablished,
            size: e.companySize,
            benefits: e.benefitsOffered,
            social: e.socialLinks,
            mission: e.mission,
            vision: e.vision,
            culture: e.culture,
            verified: e.verificationStatus,
          })
          .from(e)
          .where(and(eq(e.slug, input.slug), isNull(e.deletedAt)))
          .limit(1);
        if (!row) return null;

        const media = await ctx.db
          .select({ id: tables.companyMedia.id, type: tables.companyMedia.type, path: tables.companyMedia.storagePath })
          .from(tables.companyMedia)
          .where(eq(tables.companyMedia.employerId, row.id))
          .orderBy(desc(tables.companyMedia.uploadedAt));
        const stories = await ctx.db
          .select({ id: tables.companyCultureStories.id, title: tables.companyCultureStories.title, story: tables.companyCultureStories.story, photoPath: tables.companyCultureStories.photoPath, authorName: tables.companyCultureStories.authorName })
          .from(tables.companyCultureStories)
          .where(eq(tables.companyCultureStories.employerId, row.id))
          .orderBy(desc(tables.companyCultureStories.publishedAt))
          .limit(20);

        const { logoR2Key, ...rest } = row;
        return {
          ...rest,
          logoUrl: keyToUrl(logoR2Key),
          banner: keyToUrl(media.find((m) => m.type === 'banner')?.path ?? null),
          gallery: media.filter((m) => m.type === 'photo').map((m) => ({ id: m.id, url: keyToUrl(m.path)! })),
          stories: stories.map((s) => ({ ...s, photoUrl: keyToUrl(s.photoPath) })),
        };
      });
    }),

  // Directory of companies with a public profile.
  listCompanies: publicProcedure
    .input(z.object({ q: z.string().max(80).optional(), size: z.string().max(20).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const e = tables.employers;
      const conds = [isNull(e.deletedAt), sql`${e.slug} is not null`];
      if (input?.q) conds.push(ilike(e.displayNameEn, `%${input.q}%`));
      if (input?.size) conds.push(eq(e.companySize, input.size));
      return ctx.db
        .select({
          slug: e.slug,
          name: e.displayNameEn,
          type: e.employerTypeCode,
          district: e.district,
          size: e.companySize,
          logoR2Key: e.logoR2Key,
          verified: e.verificationStatus,
          openJobs: sql<number>`(select count(*)::int from jobs j where j.employer_id = ${e.id} and j.status = 'active' and j.deleted_at is null)`,
        })
        .from(e)
        .where(and(...conds))
        .orderBy(desc(sql`(select count(*) from jobs j where j.employer_id = ${e.id} and j.status = 'active' and j.deleted_at is null)`))
        .limit(100)
        .then((rows) => rows.map((r) => ({ ...r, logoUrl: keyToUrl(r.logoR2Key) })));
    }),

  updateCompanyProfile: emp
    .input(
      z.object({
        bio: z.string().max(2000).optional(),
        mission: z.string().max(1000).optional(),
        vision: z.string().max(1000).optional(),
        culture: z.string().max(2000).optional(),
        founded: z.number().int().min(1900).max(2100).nullable().optional(),
        size: z.string().max(20).optional(),
        website: z.string().url().max(255).optional().or(z.literal('')),
        benefits: z.array(z.string().max(60)).max(30).optional(),
        social: z.record(z.string().max(200)).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const e = await ownEmployer(ctx.db, ctx.user.id);
      if (!e) throw new TRPCError({ code: 'NOT_FOUND', message: 'No employer account' });
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.bio !== undefined) set.companyDescription = input.bio;
      if (input.mission !== undefined) set.mission = input.mission;
      if (input.vision !== undefined) set.vision = input.vision;
      if (input.culture !== undefined) set.culture = input.culture;
      if (input.founded !== undefined) set.yearEstablished = input.founded;
      if (input.size !== undefined) set.companySize = input.size;
      if (input.website !== undefined) set.websiteUrl = input.website || null;
      if (input.benefits !== undefined) set.benefitsOffered = input.benefits;
      if (input.social !== undefined) set.socialLinks = input.social;
      await ctx.db.update(tables.employers).set(set).where(eq(tables.employers.id, e.id));
      await invalidateBranding(ctx.db, e.id);
      return { success: true as const };
    }),

  // Editable profile for the owner (prefills the edit form).
  getMyProfile: emp.query(async ({ ctx }) => {
    const e = tables.employers;
    const [row] = await ctx.db
      .select({
        id: e.id,
        slug: e.slug,
        name: e.displayNameEn,
        bio: e.companyDescription,
        mission: e.mission,
        vision: e.vision,
        culture: e.culture,
        founded: e.yearEstablished,
        size: e.companySize,
        website: e.websiteUrl,
        benefits: e.benefitsOffered,
        social: e.socialLinks,
        logoR2Key: e.logoR2Key,
      })
      .from(e)
      .where(and(eq(e.ownerUserId, ctx.user.id), isNull(e.deletedAt)))
      .limit(1);
    if (!row) return null;
    const media = await ctx.db
      .select({ id: tables.companyMedia.id, type: tables.companyMedia.type, path: tables.companyMedia.storagePath })
      .from(tables.companyMedia)
      .where(eq(tables.companyMedia.employerId, row.id))
      .orderBy(desc(tables.companyMedia.uploadedAt));
    const stories = await ctx.db
      .select({ id: tables.companyCultureStories.id, title: tables.companyCultureStories.title, story: tables.companyCultureStories.story })
      .from(tables.companyCultureStories)
      .where(eq(tables.companyCultureStories.employerId, row.id))
      .orderBy(desc(tables.companyCultureStories.publishedAt));
    const { logoR2Key, ...rest } = row;
    return {
      ...rest,
      logoUrl: keyToUrl(logoR2Key),
      banner: keyToUrl(media.find((m) => m.type === 'banner')?.path ?? null),
      gallery: media.filter((m) => m.type === 'photo').map((m) => ({ id: m.id, url: keyToUrl(m.path)! })),
      stories,
    };
  }),

  uploadCompanyMedia: emp
    .input(z.object({ type: z.enum(['banner', 'photo']), base64: z.string().min(1), mime: z.enum(['image/jpeg', 'image/png', 'image/webp']) }))
    .mutation(async ({ ctx, input }) => {
      const e = await ownEmployer(ctx.db, ctx.user.id);
      if (!e) throw new TRPCError({ code: 'NOT_FOUND', message: 'No employer account' });
      const cm = tables.companyMedia;
      if (input.type === 'photo') {
        const [c] = await ctx.db.select({ n: count() }).from(cm).where(and(eq(cm.employerId, e.id), eq(cm.type, 'photo')));
        if ((c?.n ?? 0) >= MAX_PHOTOS) throw new TRPCError({ code: 'BAD_REQUEST', message: `Max ${MAX_PHOTOS} photos` });
      }
      const url = await storeImage(e.id, input.type, input.base64, input.mime);
      if (input.type === 'banner') {
        await ctx.db.delete(cm).where(and(eq(cm.employerId, e.id), eq(cm.type, 'banner')));
        await ctx.db.update(tables.employers).set({ bannerR2Key: url }).where(eq(tables.employers.id, e.id));
      }
      const [row] = await ctx.db.insert(cm).values({ employerId: e.id, type: input.type, storagePath: url }).returning({ id: cm.id });
      await invalidateBranding(ctx.db, e.id);
      return { id: row!.id, url: keyToUrl(url)! };
    }),

  deleteCompanyMedia: emp
    .input(z.object({ mediaId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const e = await ownEmployer(ctx.db, ctx.user.id);
      if (!e) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.db.delete(tables.companyMedia).where(and(eq(tables.companyMedia.id, input.mediaId), eq(tables.companyMedia.employerId, e.id)));
      await invalidateBranding(ctx.db, e.id);
      return { ok: true as const };
    }),

  addCultureStory: emp
    .input(z.object({ title: z.string().min(2).max(200), story: z.string().min(10).max(4000), authorName: z.string().max(120).optional(), photoBase64: z.string().optional(), mime: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional() }))
    .mutation(async ({ ctx, input }) => {
      const e = await ownEmployer(ctx.db, ctx.user.id);
      if (!e) throw new TRPCError({ code: 'NOT_FOUND', message: 'No employer account' });
      let photoPath: string | null = null;
      if (input.photoBase64 && input.mime) photoPath = await storeImage(e.id, 'story', input.photoBase64, input.mime);
      const [row] = await ctx.db
        .insert(tables.companyCultureStories)
        .values({ employerId: e.id, title: input.title, story: input.story, authorName: input.authorName ?? null, photoPath })
        .returning({ id: tables.companyCultureStories.id });
      await invalidateBranding(ctx.db, e.id);
      return { id: row!.id };
    }),

  deleteCultureStory: emp
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const e = await ownEmployer(ctx.db, ctx.user.id);
      if (!e) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.db.delete(tables.companyCultureStories).where(and(eq(tables.companyCultureStories.id, input.id), eq(tables.companyCultureStories.employerId, e.id)));
      await invalidateBranding(ctx.db, e.id);
      return { ok: true as const };
    }),
});
