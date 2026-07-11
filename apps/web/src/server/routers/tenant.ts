import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, eq, tables, type Database } from '@ddotsjobs/db';
import { publicProcedure, roleProcedure, router } from '../trpc.js';

const admin = roleProcedure('admin', 'super_admin');
const DEFAULT_SLUG = 'ddotsjobs';
const ROOT_DOMAIN = 'ddotsjobs.com';
const DEFAULT_FEATURES = ['job_posting', 'chat', 'video_interviews', 'referrals', 'endorsements', 'reviews', 'screening'];

const colorsSchema = z.object({ primary: z.string().max(20).optional(), secondary: z.string().max(20).optional(), accent: z.string().max(20).optional() });

// Resolve the active tenant from the request host: exact custom domain, then
// `<slug>.ddotsjobs.com` subdomain, then the default tenant.
async function resolveTenant(db: Database, host: string) {
  const clean = host.split(':')[0]!.replace(/^www\./, '').toLowerCase();
  const t = tables.tenants;

  const [byDomain] = await db.select().from(t).where(and(eq(t.domain, clean), eq(t.isActive, true))).limit(1);
  if (byDomain) return byDomain;

  if (clean.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = clean.slice(0, -1 * (ROOT_DOMAIN.length + 1));
    if (slug && slug !== 'www') {
      const [bySub] = await db.select().from(t).where(and(eq(t.slug, slug), eq(t.isActive, true))).limit(1);
      if (bySub) return bySub;
    }
  }

  const [dflt] = await db.select().from(t).where(eq(t.slug, DEFAULT_SLUG)).limit(1);
  return dflt ?? null;
}

export const tenantRouter = router({
  // Branding + enabled features for the current host. Public.
  getTenantBranding: publicProcedure.query(async ({ ctx }) => {
    const host = ctx.headers.get('host') ?? ROOT_DOMAIN;
    const tenant = await resolveTenant(ctx.db, host);
    if (!tenant) {
      return { slug: DEFAULT_SLUG, name: 'ddotsjobs', logo: null as string | null, colors: {}, features: DEFAULT_FEATURES };
    }
    const feats = await ctx.db
      .select({ feature: tables.tenantFeatures.feature })
      .from(tables.tenantFeatures)
      .where(and(eq(tables.tenantFeatures.tenantId, tenant.id), eq(tables.tenantFeatures.isEnabled, true)));
    return { slug: tenant.slug, name: tenant.name, logo: tenant.logo, colors: tenant.colors, features: feats.map((f) => f.feature) };
  }),

  listTenantsForAdmin: admin.query(async ({ ctx }) => {
    const t = tables.tenants;
    const rows = await ctx.db.select().from(t).orderBy(t.createdAt);
    const feats = await ctx.db.select({ tenantId: tables.tenantFeatures.tenantId, feature: tables.tenantFeatures.feature, isEnabled: tables.tenantFeatures.isEnabled }).from(tables.tenantFeatures);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      domain: r.domain,
      name: r.name,
      logo: r.logo,
      colors: r.colors,
      isActive: r.isActive,
      features: feats.filter((f) => f.tenantId === r.id).map((f) => ({ feature: f.feature, isEnabled: f.isEnabled })),
    }));
  }),

  createTenant: admin
    .input(z.object({ slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/), domain: z.string().max(255).optional(), name: z.string().min(2).max(120), colors: colorsSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select({ id: tables.tenants.id }).from(tables.tenants).where(eq(tables.tenants.slug, input.slug)).limit(1);
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Slug already taken' });
      const [row] = await ctx.db
        .insert(tables.tenants)
        .values({ slug: input.slug, domain: input.domain || null, name: input.name, colors: input.colors ?? {} })
        .returning({ id: tables.tenants.id });
      if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await ctx.db.insert(tables.tenantFeatures).values(DEFAULT_FEATURES.map((feature) => ({ tenantId: row.id, feature, isEnabled: true })));
      return { id: row.id };
    }),

  updateTenantBranding: admin
    .input(z.object({ tenantId: z.string().uuid(), name: z.string().min(2).max(120).optional(), domain: z.string().max(255).nullable().optional(), logo: z.string().max(500).nullable().optional(), colors: colorsSchema.optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) set.name = input.name;
      if (input.domain !== undefined) set.domain = input.domain || null;
      if (input.logo !== undefined) set.logo = input.logo;
      if (input.colors !== undefined) set.colors = input.colors;
      if (input.isActive !== undefined) set.isActive = input.isActive;
      await ctx.db.update(tables.tenants).set(set).where(eq(tables.tenants.id, input.tenantId));
      return { success: true as const };
    }),

  toggleTenantFeature: admin
    .input(z.object({ tenantId: z.string().uuid(), feature: z.string().min(2).max(50), isEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const tf = tables.tenantFeatures;
      await ctx.db
        .insert(tf)
        .values({ tenantId: input.tenantId, feature: input.feature, isEnabled: input.isEnabled })
        .onConflictDoUpdate({ target: [tf.tenantId, tf.feature], set: { isEnabled: input.isEnabled } });
      return { success: true as const };
    }),
});
