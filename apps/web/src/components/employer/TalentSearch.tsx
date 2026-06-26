'use client';

import { useMemo, useState } from 'react';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { trpc } from '@/lib/trpc/client';
import type { AppRouter } from '@/server/routers/_app';
import { CompletionRing } from '@/components/seeker/CompletionRing';
import { DISTRICTS, SECTORS } from '@/lib/constants';

type SearchInput = inferRouterInputs<AppRouter>['talentPool']['search'];
type Candidate = inferRouterOutputs<AppRouter>['talentPool']['search']['items'][number];

const EXPERIENCE = [
  { label: 'Any experience', months: undefined },
  { label: '6 months+', months: 6 },
  { label: '1 year+', months: 12 },
  { label: '2 years+', months: 24 },
  { label: '5 years+', months: 60 },
] as const;

const CERTS = [
  { label: 'Any certification', value: undefined },
  { label: 'KNMC verified', value: 'KNMC' },
  { label: 'KTET verified', value: 'KTET' },
] as const;

const AVATAR_COLORS = ['#f5a800', '#007d77', '#c0392b', '#2e7d32', '#6a4fb3', '#0277bd', '#d2691e', '#b8860b'];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

function expLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0 && m === 0) return 'Fresher';
  return [y > 0 ? `${y} yr` : '', m > 0 ? `${m} mo` : ''].filter(Boolean).join(' ');
}

function titleCase(s: string | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

export function TalentSearch({ canAccess }: { canAccess: boolean }) {
  const [category, setCategory] = useState('');
  const [district, setDistrict] = useState('');
  const [expIdx, setExpIdx] = useState(0);
  const [certIdx, setCertIdx] = useState(0);
  const [committed, setCommitted] = useState<SearchInput>({ limit: 20 });
  const [extra, setExtra] = useState<Candidate[]>([]);
  const [moreCursor, setMoreCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [contactTarget, setContactTarget] = useState<Candidate | null>(null);

  const utils = trpc.useUtils();
  const quota = trpc.talentPool.contactQuota.useQuery(undefined, { enabled: canAccess });
  const search = trpc.talentPool.search.useQuery(committed, { enabled: canAccess });

  const items = useMemo(() => [...(search.data?.items ?? []), ...extra], [search.data, extra]);
  const cursor = extra.length > 0 ? moreCursor : (search.data?.nextCursor ?? null);

  function runSearch() {
    setExtra([]);
    setMoreCursor(null);
    setCommitted({
      limit: 20,
      ...(category ? { category } : {}),
      ...(district ? { district: district as SearchInput['district'] } : {}),
      ...(EXPERIENCE[expIdx]!.months != null ? { minExperienceMonths: EXPERIENCE[expIdx]!.months } : {}),
      ...(CERTS[certIdx]!.value ? { certType: CERTS[certIdx]!.value } : {}),
    });
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await utils.talentPool.search.fetch({ ...committed, cursor });
      setExtra((p) => [...p, ...res.items]);
      setMoreCursor(res.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  if (!canAccess) {
    return (
      <div style={s.locked}>
        <p style={{ fontWeight: 700, fontSize: 16 }}>Talent pool is for verified employers.</p>
        <p style={{ color: '#6b6b66' }}>Your account is pending verification. We&rsquo;ll notify you once approved.</p>
      </div>
    );
  }

  const used = quota.data?.used ?? 0;
  const limit = quota.data?.limit ?? 10;

  return (
    <>
      {/* Filter bar */}
      <div style={s.filterBar}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" style={s.select}>
          <option value="">All categories</option>
          {SECTORS.map((sec) => <option key={sec.slug} value={sec.slug}>{sec.label}</option>)}
        </select>
        <select value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="District" style={s.select}>
          <option value="">All districts</option>
          {DISTRICTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select value={expIdx} onChange={(e) => setExpIdx(Number(e.target.value))} aria-label="Experience" style={s.select}>
          {EXPERIENCE.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}
        </select>
        <select value={certIdx} onChange={(e) => setCertIdx(Number(e.target.value))} aria-label="Certification" style={s.select}>
          {CERTS.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
        </select>
        <button type="button" onClick={runSearch} className="hp-btn" style={s.searchBtn}>Search</button>
        <span style={s.quota}>{used} of {limit} contacts used today</span>
      </div>

      {/* Results */}
      {search.isLoading ? (
        <p style={{ color: '#6b6b66' }}>Searching…</p>
      ) : items.length === 0 ? (
        <div style={s.empty}>
          <p style={{ fontWeight: 600 }}>No candidates match your filters.</p>
          <p style={{ color: '#6b6b66' }}>Try broadening your search.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {items.map((c) => (
            <article key={c.id} style={s.card}>
              <div style={s.cardTop}>
                <div style={{ ...s.avatar, background: avatarColor(c.id) }} aria-hidden>{c.firstName.slice(0, 1).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={s.name}>{c.firstName}</p>
                  <p style={s.meta}>{titleCase(c.district)} · {expLabel(c.totalExperienceMonths)}</p>
                </div>
                <div style={s.ringWrap}><CompletionRing pct={c.completionPct} size={40} /></div>
              </div>

              <div style={s.chips}>
                {c.preferredCategories.slice(0, 3).map((cat) => (
                  <span key={cat} style={s.chip}>{titleCase(cat)}</span>
                ))}
              </div>

              <div style={s.badges}>
                {c.hasVerifiedCert && <span style={s.certBadge}>✓ {c.primaryCert ?? 'Verified'}</span>}
                {c.urgencyLevel === 'immediate' && <span style={s.urgentBadge}>Available immediately</span>}
              </div>

              <button type="button" onClick={() => setContactTarget(c)} style={s.contactBtn}>Contact</button>
            </article>
          ))}
        </div>
      )}

      {cursor && items.length > 0 && (
        <button type="button" onClick={loadMore} disabled={loadingMore} style={s.more}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}

      <p style={s.privacy}>
        Candidate phone numbers are never shared. All contact happens through ddotsjobs.com.
      </p>

      {contactTarget && (
        <ContactModal
          candidate={contactTarget}
          used={used}
          limit={limit}
          onClose={() => setContactTarget(null)}
          onSent={() => {
            void utils.talentPool.contactQuota.invalidate();
            setContactTarget(null);
          }}
        />
      )}
    </>
  );
}

function ContactModal({
  candidate, used, limit, onClose, onSent,
}: {
  candidate: Candidate; used: number; limit: number; onClose: () => void; onSent: () => void;
}) {
  const [message, setMessage] = useState('');
  const contact = trpc.talentPool.contactSeeker.useMutation({ onSuccess: onSent });

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.modalTitle}>Contact {candidate.firstName}</h2>
        <p style={s.modalSub}>Candidate will be notified on platform. Your contact limit: {used} of {limit} used today.</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="Introduce your company and the role…"
          style={s.textarea}
        />
        <div style={s.modalFoot}>
          <span style={s.count}>{message.length}/500</span>
          <div style={s.modalBtns}>
            <button type="button" onClick={onClose} style={s.cancelBtn}>Cancel</button>
            <button
              type="button"
              disabled={message.trim().length === 0 || contact.isPending}
              onClick={() => contact.mutate({ seekerId: candidate.id, message: message.trim() })}
              style={{ ...s.sendBtn, opacity: message.trim().length === 0 || contact.isPending ? 0.55 : 1 }}
            >
              {contact.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
        {contact.error && <p style={s.err}>{contact.error.message}</p>}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  locked: { padding: 'var(--space-4)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', textAlign: 'center' },
  filterBar: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  select: { minHeight: 44, flex: '1 1 140px', minWidth: 0, padding: '0 12px', fontSize: 14, background: '#faf9f5', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)' },
  searchBtn: { minHeight: 44, padding: '0 24px', fontSize: 15, fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  quota: { marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#55554f' },
  empty: { padding: 'var(--space-4)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-2)' },
  card: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  cardTop: { display: 'flex', gap: 'var(--space-1)', alignItems: 'center' },
  avatar: { flex: '0 0 44px', width: 44, height: 44, borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 },
  name: { fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-dark)' },
  meta: { fontSize: 13, color: '#6b6b66', margin: '2px 0 0' },
  ringWrap: { flex: '0 0 40px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 12, color: '#55554f', background: '#f1f1ec', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  badges: { display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 4 },
  certBadge: { fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--color-accent)', padding: '3px 10px', borderRadius: 'var(--radius-pill)' },
  urgentBadge: { fontSize: 12, fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', padding: '3px 10px', borderRadius: 'var(--radius-pill)' },
  contactBtn: { marginTop: 4, minHeight: 42, fontSize: 14, fontWeight: 700, color: '#fff', background: 'var(--color-dark)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  more: { alignSelf: 'center', minHeight: 44, padding: '0 28px', fontSize: 15, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  privacy: { fontSize: 12, color: '#9a9a92', textAlign: 'center', marginTop: 'var(--space-2)' },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2)', zIndex: 100 },
  modal: { width: '100%', maxWidth: 460, background: '#fff', borderRadius: 'var(--radius-card)', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  modalTitle: { fontSize: '1.3rem', fontWeight: 700, margin: 0 },
  modalSub: { fontSize: 13, color: '#6b6b66', margin: 0 },
  textarea: { width: '100%', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginTop: 6 },
  modalFoot: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 12, color: '#9a9a92' },
  modalBtns: { display: 'flex', gap: 8 },
  cancelBtn: { minHeight: 42, padding: '0 18px', fontSize: 14, fontWeight: 600, background: 'none', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  sendBtn: { minHeight: 42, padding: '0 24px', fontSize: 14, fontWeight: 700, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  err: { fontSize: 13, color: '#c0392b', margin: 0 },
};
