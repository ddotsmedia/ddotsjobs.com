// Bidirectional mapping between /jobs URL params and the jobs.list input.
// Pure functions — safe on server (page) and client (FilterPanel).

import type { JobsListInput } from '@/server/routers/jobs';

export type SortMode = 'latest' | 'salary_desc' | 'salary_asc';

export interface JobFilters {
  q?: string;
  districts: string[];
  categories: string[];
  jobTypes: string[];
  salaryMin?: number; // paise
  isWalkIn: boolean;
  valuesGulfExperience: boolean;
  salaryDisclosed: boolean;
  itPark?: string;
  sort: SortMode;
}

type SP = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
function csv(v: string | string[] | undefined): string[] {
  const s = one(v);
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export function parseJobFilters(sp: SP): JobFilters {
  const sortRaw = one(sp.sort);
  const sort: SortMode =
    sortRaw === 'salary_desc' || sortRaw === 'salary_asc' ? sortRaw : 'latest';
  const salaryRaw = one(sp.salary_min);
  const salaryMin = salaryRaw && /^\d+$/.test(salaryRaw) ? Number(salaryRaw) : undefined;

  return {
    q: one(sp.q)?.trim() || undefined,
    districts: csv(sp.district),
    categories: csv(sp.category),
    jobTypes: csv(sp.job_type),
    salaryMin,
    isWalkIn: one(sp.is_walk_in) === '1',
    valuesGulfExperience: one(sp.gulf) === '1',
    salaryDisclosed: one(sp.salary_disclosed) === '1',
    itPark: one(sp.it_park) || undefined,
    sort,
  };
}

export function filtersToQuery(f: JobFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.districts.length) p.set('district', f.districts.join(','));
  if (f.categories.length) p.set('category', f.categories.join(','));
  if (f.jobTypes.length) p.set('job_type', f.jobTypes.join(','));
  if (f.salaryMin != null) p.set('salary_min', String(f.salaryMin));
  if (f.isWalkIn) p.set('is_walk_in', '1');
  if (f.valuesGulfExperience) p.set('gulf', '1');
  if (f.salaryDisclosed) p.set('salary_disclosed', '1');
  if (f.itPark) p.set('it_park', f.itPark);
  if (f.sort !== 'latest') p.set('sort', f.sort);
  return p.toString();
}

/** Count of non-default active filters (for the mobile "Filters" badge). */
export function activeFilterCount(f: JobFilters): number {
  let n = 0;
  if (f.q) n++;
  n += f.districts.length + f.categories.length + f.jobTypes.length;
  if (f.salaryMin != null) n++;
  if (f.isWalkIn) n++;
  if (f.valuesGulfExperience) n++;
  if (f.salaryDisclosed) n++;
  if (f.itPark) n++;
  return n;
}

/** Convert filters to the jobs.list tRPC input (cursor/limit added by caller). */
export function filtersToInput(f: JobFilters): Omit<JobsListInput, 'cursor' | 'limit'> {
  return {
    q: f.q,
    districts: f.districts.length ? (f.districts as JobsListInput['districts']) : undefined,
    categories: f.categories.length ? f.categories : undefined,
    jobTypes: f.jobTypes.length ? (f.jobTypes as JobsListInput['jobTypes']) : undefined,
    salaryMin: f.salaryMin,
    isWalkIn: f.isWalkIn || undefined,
    valuesGulfExperience: f.valuesGulfExperience || undefined,
    salaryDisclosed: f.salaryDisclosed || undefined,
    itPark: f.itPark as JobsListInput['itPark'],
    sort: f.sort,
  };
}
