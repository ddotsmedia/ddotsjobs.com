import type { MetadataRoute } from 'next';
import { and, db, desc, eq, isNull, ne, tables } from '@ddotsjobs/db';
import { CATEGORY_SEO, DISTRICTS } from '@/lib/constants';

// Render on demand (DB-backed) — never statically collect at build time.
export const dynamic = 'force-dynamic';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ddotsjobs.com';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1.0, lastModified: now },
    { url: `${BASE}/jobs`, changeFrequency: 'hourly', priority: 0.9, lastModified: now },
    { url: `${BASE}/psc`, changeFrequency: 'daily', priority: 0.8, lastModified: now },
    { url: `${BASE}/gulf-return`, changeFrequency: 'weekly', priority: 0.7, lastModified: now },
    { url: `${BASE}/technopark-jobs`, changeFrequency: 'daily', priority: 0.8, lastModified: now },
    { url: `${BASE}/infopark-jobs`, changeFrequency: 'daily', priority: 0.8, lastModified: now },
    { url: `${BASE}/cyberpark-jobs`, changeFrequency: 'daily', priority: 0.8, lastModified: now },
  ];

  const districtRoutes: MetadataRoute.Sitemap = DISTRICTS.map((d) => ({
    url: `${BASE}/jobs/${d.value}`,
    changeFrequency: 'weekly',
    priority: 0.7,
    lastModified: now,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORY_SEO.map((c) => ({
    url: `${BASE}/jobs/category/${c.param}`,
    changeFrequency: 'weekly',
    priority: 0.7,
    lastModified: now,
  }));

  const jobRows = await safe(
    () =>
      db
        .select({ slug: tables.jobs.slug, updatedAt: tables.jobs.updatedAt })
        .from(tables.jobs)
        .where(and(eq(tables.jobs.status, 'active'), isNull(tables.jobs.deletedAt)))
        .orderBy(desc(tables.jobs.updatedAt))
        .limit(1000),
    [] as { slug: string | null; updatedAt: Date }[],
  );
  const jobRoutes: MetadataRoute.Sitemap = jobRows
    .filter((j) => j.slug)
    .map((j) => ({
      url: `${BASE}/jobs/${j.slug}`,
      changeFrequency: 'daily',
      priority: 0.8,
      lastModified: j.updatedAt,
    }));

  const pscRows = await safe(
    () =>
      db
        .select({ categoryNo: tables.pscNotifications.categoryNumber, updatedAt: tables.pscNotifications.updatedAt })
        .from(tables.pscNotifications)
        .where(and(ne(tables.pscNotifications.status, 'closed'), isNull(tables.pscNotifications.deletedAt)))
        .limit(1000),
    [] as { categoryNo: string; updatedAt: Date }[],
  );
  const pscRoutes: MetadataRoute.Sitemap = pscRows.map((p) => ({
    url: `${BASE}/psc/${p.categoryNo}`,
    changeFrequency: 'weekly',
    priority: 0.7,
    lastModified: p.updatedAt,
  }));

  return [...staticRoutes, ...districtRoutes, ...categoryRoutes, ...jobRoutes, ...pscRoutes];
}
