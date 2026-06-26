import type { Metadata } from 'next';
import { getServerTrpc } from '@/lib/trpc/server';
import { FilterPanel } from '@/components/jobs/FilterPanel';
import { JobResults } from '@/components/jobs/JobResults';
import { MobileFilterButton } from '@/components/jobs/MobileFilterButton';
import { SearchSortBar } from '@/components/jobs/SearchSortBar';
import { CATEGORIES_UI, DISTRICTS } from '@/lib/constants';
import { filtersToInput, parseJobFilters } from '@/lib/jobFilters';

export const revalidate = 60;

type SP = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SP> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseJobFilters(await searchParams);
  let title = 'Jobs in Kerala — ddotsjobs.com';
  if (f.categories.length === 1) {
    const label = CATEGORIES_UI.find((c) => c.slug === f.categories[0])?.label;
    if (label) title = `${label} Jobs in Kerala — ddotsjobs.com`;
  } else if (f.districts.length === 1) {
    const label = DISTRICTS.find((d) => d.value === f.districts[0])?.label;
    if (label) title = `Jobs in ${label} — ddotsjobs.com`;
  }
  const description =
    'Browse verified jobs across all 14 Kerala districts. Filter by sector, district, salary and job type.';
  return { title, description, openGraph: { title, description } };
}

function headingFor(f: ReturnType<typeof parseJobFilters>): string {
  if (f.categories.length === 1) {
    const label = CATEGORIES_UI.find((c) => c.slug === f.categories[0])?.label;
    if (label) return `${label} jobs`;
  }
  if (f.districts.length === 1) {
    const label = DISTRICTS.find((d) => d.value === f.districts[0])?.label;
    if (label) return `Jobs in ${label}`;
  }
  return 'Jobs in Kerala';
}

export default async function JobsPage({ searchParams }: Props) {
  const filters = parseJobFilters(await searchParams);
  const input = filtersToInput(filters);

  const trpc = await getServerTrpc();
  const [list, countRes] = await Promise.all([
    trpc.jobs.list({ ...input, limit: 20 }),
    trpc.jobs.count(input),
  ]);

  return (
    <main style={s.page}>
      <div style={s.container}>
        <h1 style={s.h1}>{headingFor(filters)}</h1>

        <div style={s.layout}>
          <aside className="ddj-desktop-only" style={s.sidebar}>
            <FilterPanel initial={filters} />
          </aside>

          <div style={s.main}>
            <div style={s.toolbar}>
              <MobileFilterButton initial={filters} />
              <SearchSortBar initial={filters} total={countRes.total} />
            </div>
            <JobResults initialItems={list.items} initialCursor={list.nextCursor} input={input} />
          </div>
        </div>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 1040, margin: '0 auto', padding: '0 var(--space-2)' },
  h1: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 'clamp(1.8rem, 6vw, 2.6rem)',
    margin: 'var(--space-3) 0 var(--space-2)',
  },
  layout: { display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' },
  sidebar: {
    flex: '0 0 240px',
    width: 240,
    position: 'sticky',
    top: 'var(--space-2)',
    padding: 'var(--space-2)',
    background: '#fff',
    borderRadius: 'var(--radius-card)',
    border: '1px solid #efefe9',
  },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  toolbar: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    padding: 'var(--space-1) 0',
    background: 'var(--color-neutral)',
  },
};
