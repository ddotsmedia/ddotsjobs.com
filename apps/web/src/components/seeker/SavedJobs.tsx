'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { CATEGORIES_UI, DISTRICTS } from '@/lib/constants';
import { relativeTime, rupeesPerMonth, titleCase } from '@/lib/format';

type Sort = 'recent' | 'salary_desc' | 'salary_asc' | 'expiring';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recently saved' },
  { key: 'salary_desc', label: 'Salary: high → low' },
  { key: 'salary_asc', label: 'Salary: low → high' },
  { key: 'expiring', label: 'Expiring soon' },
];
const TEAL = '#3A9EA5';

const catLabel = (slug: string | null) => CATEGORIES_UI.find((c) => c.slug === slug)?.label ?? (slug ? titleCase(slug) : '');
const distLabel = (v: string | null) => DISTRICTS.find((d) => d.value === v)?.label ?? (v ? titleCase(v) : '');

export function SavedJobs() {
  const router = useRouter();
  const params = useSearchParams();
  const q = trpc.jobs.getSavedJobs.useQuery();
  const utils = trpc.useUtils();

  const [sort, setSort] = useState<Sort>((params.get('sort') as Sort) || 'recent');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState(params.get('category') ?? '');
  const [district, setDistrict] = useState(params.get('district') ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const unsaveMany = trpc.jobs.unsaveMany.useMutation({
    onSuccess: () => {
      setSelected(new Set());
      void utils.jobs.getSavedJobs.invalidate();
      void utils.jobs.getSavedJobCount.invalidate();
      void utils.jobs.getSavedJobIds.invalidate();
    },
  });

  // Persist sort/filter/search to the URL (shallow replace, no scroll jump).
  const syncUrl = (next: Partial<{ sort: string; q: string; category: string; district: string }>) => {
    const p = new URLSearchParams(params.toString());
    const set = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
    if (next.sort !== undefined) set('sort', next.sort === 'recent' ? '' : next.sort);
    if (next.q !== undefined) set('q', next.q);
    if (next.category !== undefined) set('category', next.category);
    if (next.district !== undefined) set('district', next.district);
    const qs = p.toString();
    router.replace(qs ? `/seeker/saved-jobs?${qs}` : '/seeker/saved-jobs', { scroll: false });
  };

  const rows = q.data ?? [];
  const categories = useMemo(() => [...new Set(rows.map((r) => r.categorySlug).filter(Boolean))] as string[], [rows]);
  const districts = useMemo(() => [...new Set(rows.map((r) => r.district).filter(Boolean))] as string[], [rows]);

  const view = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (category === '' || r.categorySlug === category) &&
        (district === '' || r.district === district) &&
        (term === '' || r.titleEn.toLowerCase().includes(term) || r.company.toLowerCase().includes(term)),
    );
    const salaryKey = (v: number | null) => (v == null ? -1 : v);
    const expKey = (v: Date | null) => (v == null ? Infinity : new Date(v).getTime());
    const sorted = [...filtered];
    if (sort === 'recent') sorted.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    else if (sort === 'salary_desc') sorted.sort((a, b) => salaryKey(b.salaryMinPaise) - salaryKey(a.salaryMinPaise));
    else if (sort === 'salary_asc') sorted.sort((a, b) => salaryKey(a.salaryMinPaise) - salaryKey(b.salaryMinPaise));
    else if (sort === 'expiring') sorted.sort((a, b) => expKey(a.validThrough) - expKey(b.validThrough));
    return sorted;
  }, [rows, search, category, district, sort]);

  const allSelected = view.length > 0 && view.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(view.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onUnsaveSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    unsaveMany.mutate({ jobIds: ids });
  };

  const emailSelected = () => {
    const chosen = view.filter((r) => selected.has(r.id));
    const list = (chosen.length ? chosen : view)
      .map((r) => `• ${r.titleEn} — ${r.company}\n  https://ddotsjobs.com/jobs/${r.slug ?? r.id}`)
      .join('\n\n');
    const subject = encodeURIComponent('My saved jobs on ddotsjobs.com');
    const body = encodeURIComponent(`Saved jobs:\n\n${list}\n\n— via ddotsjobs.com`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <>
      <header style={s.head}>
        <div>
          <h1 style={s.h1}>Saved jobs</h1>
          <p style={s.sub}>{q.isLoading ? 'Loading…' : `${rows.length} saved`}</p>
        </div>
      </header>

      {q.isLoading ? (
        <div style={s.list}>
          {[0, 1, 2].map((i) => <div key={i} style={{ ...s.skel, height: 92 }} />)}
        </div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon} aria-hidden>♡</div>
          <p style={s.emptyTitle}>No saved jobs yet.</p>
          <p style={s.emptySub}>Browse and tap the heart to save jobs to your wishlist.</p>
          <Link href="/jobs" style={s.browseBtn}>Browse jobs</Link>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div style={s.controls}>
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); syncUrl({ q: e.target.value }); }}
              placeholder="Search saved jobs…"
              style={s.searchBox}
            />
            <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); syncUrl({ sort: e.target.value }); }} style={s.select}>
              {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <select value={category} onChange={(e) => { setCategory(e.target.value); syncUrl({ category: e.target.value }); }} style={s.select}>
              <option value="">All sectors</option>
              {categories.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
            </select>
            <select value={district} onChange={(e) => { setDistrict(e.target.value); syncUrl({ district: e.target.value }); }} style={s.select}>
              <option value="">All districts</option>
              {districts.map((dd) => <option key={dd} value={dd}>{distLabel(dd)}</option>)}
            </select>
          </div>

          {/* Bulk bar */}
          <div style={s.bulkBar}>
            <label style={s.selectAll}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} style={s.checkbox} aria-label="Select all" />
              Select all
            </label>
            {selected.size > 0 && (
              <>
                <span style={s.selCount}>{selected.size} selected</span>
                <button type="button" onClick={onUnsaveSelected} disabled={unsaveMany.isPending} style={s.unsaveBtn}>
                  {unsaveMany.isPending ? 'Removing…' : 'Unsave'}
                </button>
              </>
            )}
            <button type="button" onClick={emailSelected} style={s.emailBtn}>✉ Email {selected.size > 0 ? 'selected' : 'list'}</button>
          </div>

          {view.length === 0 ? (
            <p style={s.muted}>No saved jobs match your filters.</p>
          ) : (
            <div style={s.list}>
              {view.map((r) => {
                const expired = r.status !== 'active';
                return (
                  <div key={r.id} style={s.card}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} style={s.cardCheck} aria-label={`Select ${r.titleEn}`} />
                    <div style={s.cardBody}>
                      <div style={s.cardTop}>
                        <Link href={`/jobs/${r.slug ?? r.id}`} style={s.title}>{r.titleEn}</Link>
                        <span style={s.saved}>{relativeTime(r.savedAt)}</span>
                      </div>
                      <span style={s.company}>{r.company}</span>
                      <div style={s.meta}>
                        {expired && <span style={s.expiredPill}>Closed</span>}
                        {r.isWalkIn && <span style={s.walkPill}>Walk-in</span>}
                        {r.categorySlug && <span style={s.chip}>{catLabel(r.categorySlug)}</span>}
                        {r.district && <span style={s.chip}>{distLabel(r.district)}</span>}
                        <span style={s.salary}>{rupeesPerMonth(r.salaryMinPaise, r.salaryDisclosed)}</span>
                      </div>
                    </div>
                    <div style={s.cardActions}>
                      {!expired && <Link href={`/jobs/${r.slug ?? r.id}`} style={s.applyBtn}>Apply →</Link>}
                      <button type="button" onClick={() => unsaveMany.mutate({ jobIds: [r.id] })} style={s.heartBtn} aria-label="Unsave" title="Remove from saved">♥</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { marginBottom: 'var(--space-1)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: 0, color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: '4px 0 0' },
  controls: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  searchBox: { flex: '1 1 200px', minWidth: 0, border: '1px solid #e2e2da', borderRadius: 10, padding: '10px 12px', fontSize: 14, minHeight: 44 },
  select: { border: '1px solid #e2e2da', borderRadius: 10, padding: '10px 12px', fontSize: 14, minHeight: 44, background: '#fff' },
  bulkBar: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  selectAll: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#55554f', minHeight: 44, cursor: 'pointer' },
  selCount: { fontSize: 13, fontWeight: 700, color: '#8a5a12' },
  checkbox: { width: 22, height: 22, accentColor: TEAL, cursor: 'pointer' },
  unsaveBtn: { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 40 },
  emailBtn: { background: '#fff', color: '#55554f', border: '1px solid #e2e2da', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 40 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  cardCheck: { width: 22, height: 22, marginTop: 2, accentColor: TEAL, cursor: 'pointer', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  title: { fontSize: 16, fontWeight: 600, color: '#1A1916' },
  saved: { fontSize: 12, color: '#b0ad9f', whiteSpace: 'nowrap' },
  company: { fontSize: 14, color: '#6b6860' },
  meta: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  chip: { fontSize: 12, color: '#6b6b66', background: '#f1f1ec', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  walkPill: { fontSize: 11, fontWeight: 700, color: '#1A1916', background: 'rgba(245,200,66,0.25)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' },
  expiredPill: { fontSize: 11, fontWeight: 700, color: '#c0392b', background: '#fdecea', padding: '2px 8px', borderRadius: 'var(--radius-pill)' },
  salary: { fontSize: 14, fontWeight: 700, color: TEAL },
  cardActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  applyBtn: { fontSize: 13, fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)', padding: '8px 16px', whiteSpace: 'nowrap' },
  heartBtn: { width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--color-brand)', background: '#fff', border: '1px solid #e2e2da', borderRadius: '50%', cursor: 'pointer' },
  muted: { color: '#8a8a83', fontSize: 14, padding: '6px 0' },
  skel: { display: 'block', background: 'linear-gradient(90deg,#f0efe9 25%,#e6e5df 37%,#f0efe9 63%)', borderRadius: 'var(--radius-card)' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 'var(--space-4)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', textAlign: 'center' },
  emptyIcon: { fontSize: 48, color: '#d8d8d0', lineHeight: 1 },
  emptyTitle: { fontWeight: 700, fontSize: 16, color: 'var(--color-dark)', margin: 0 },
  emptySub: { color: '#6b6b66', fontSize: 14, margin: 0 },
  browseBtn: { marginTop: 8, padding: '10px 24px', fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
};
