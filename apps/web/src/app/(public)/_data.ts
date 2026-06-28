import 'server-only';
import { and, count, db, desc, eq, isNull, tables } from '@ddotsjobs/db';

// All reads are defensive: if the DB is unreachable (e.g. local static build),
// they return safe empties so the page still renders (launch / ISR-warm state).

export interface HomeStats {
  activeJobs: number;
  verifiedEmployers: number;
  placements: number;
  whatsapp: string;
}

export interface LatestJob {
  id: string;
  slug: string | null;
  titleEn: string;
  district: string | null;
  categorySlug: string | null;
  salaryMinPaise: number | null;
  salaryMaxPaise: number | null;
  salaryDisclosed: boolean;
  isWalkIn: boolean;
  publishedAt: Date | null;
  company: string;
  employerTypeCode: string | null;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error('[home] query failed, using fallback:', String(err));
    return fallback;
  }
}

export function getHomeStats(): Promise<HomeStats> {
  return safe(
    async () => {
      const [active, employers, placements] = await Promise.all([
        db
          .select({ c: count() })
          .from(tables.jobs)
          .where(and(eq(tables.jobs.status, 'active'), isNull(tables.jobs.deletedAt))),
        db
          .select({ c: count() })
          .from(tables.employers)
          .where(
            and(
              eq(tables.employers.verificationStatus, 'verified'),
              isNull(tables.employers.deletedAt),
            ),
          ),
        db
          .select({ c: count() })
          .from(tables.applications)
          .where(eq(tables.applications.status, 'hired')),
      ]);
      return {
        activeJobs: active[0]?.c ?? 0,
        verifiedEmployers: employers[0]?.c ?? 0,
        placements: placements[0]?.c ?? 0,
        whatsapp: '120K+',
      };
    },
    { activeJobs: 0, verifiedEmployers: 0, placements: 0, whatsapp: '120K+' },
  );
}

export function getSectorCounts(): Promise<Record<string, number>> {
  return safe(
    async () => {
      const rows = await db
        .select({ slug: tables.jobs.categorySlug, c: count() })
        .from(tables.jobs)
        .where(and(eq(tables.jobs.status, 'active'), isNull(tables.jobs.deletedAt)))
        .groupBy(tables.jobs.categorySlug);
      const map: Record<string, number> = {};
      for (const r of rows) if (r.slug) map[r.slug] = r.c;
      return map;
    },
    {},
  );
}

export function getLatestJobs(): Promise<LatestJob[]> {
  return safe(
    async () => {
      const rows = await db
        .select({
          id: tables.jobs.id,
          slug: tables.jobs.slug,
          titleEn: tables.jobs.titleEn,
          district: tables.jobs.district,
          categorySlug: tables.jobs.categorySlug,
          salaryMinPaise: tables.jobs.salaryMinPaise,
          salaryMaxPaise: tables.jobs.salaryMaxPaise,
          salaryDisclosed: tables.jobs.salaryDisclosed,
          isWalkIn: tables.jobs.isWalkIn,
          publishedAt: tables.jobs.publishedAt,
          displayNameEn: tables.employers.displayNameEn,
          legalNameEn: tables.employers.legalNameEn,
          employerTypeCode: tables.employers.employerTypeCode,
        })
        .from(tables.jobs)
        .innerJoin(tables.employers, eq(tables.jobs.employerId, tables.employers.id))
        .where(and(eq(tables.jobs.status, 'active'), isNull(tables.jobs.deletedAt)))
        .orderBy(desc(tables.jobs.publishedAt))
        .limit(8);
      return rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        titleEn: r.titleEn,
        district: r.district,
        categorySlug: r.categorySlug,
        salaryMinPaise: r.salaryMinPaise,
        salaryMaxPaise: r.salaryMaxPaise,
        salaryDisclosed: r.salaryDisclosed,
        isWalkIn: r.isWalkIn,
        publishedAt: r.publishedAt,
        company: r.displayNameEn ?? r.legalNameEn,
        employerTypeCode: r.employerTypeCode,
      }));
    },
    [],
  );
}
