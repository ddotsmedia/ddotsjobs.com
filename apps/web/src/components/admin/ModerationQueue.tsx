'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { inferRouterOutputs } from '@trpc/server';
import { trpc } from '@/lib/trpc/client';
import type { AppRouter } from '@/server/routers/_app';
import { relativeTime } from '@/lib/format';

type QueueRow = inferRouterOutputs<AppRouter>['admin']['getModerationQueue'][number];

type Sort = 'oldest' | 'newest' | 'highest_risk' | 'lowest_risk';
type Filter = 'all' | 'high_risk' | 'walk_in' | 'no_salary' | 'new_employer';

const SORTS: { k: Sort; l: string }[] = [
  { k: 'oldest', l: 'Oldest' }, { k: 'newest', l: 'Newest' },
  { k: 'highest_risk', l: 'Highest risk' }, { k: 'lowest_risk', l: 'Lowest risk' },
];
const FILTERS: { k: Filter; l: string }[] = [
  { k: 'all', l: 'All' }, { k: 'high_risk', l: 'High risk' }, { k: 'walk_in', l: 'Walk-in' },
  { k: 'no_salary', l: 'No salary' }, { k: 'new_employer', l: 'New employer' },
];
const REJECT_REASONS = ['Fake job suspected', 'Phone number in description', 'Salary unrealistic', 'Duplicate posting', 'Incomplete information', 'Inappropriate content'];

function rupees(p: number | null): string {
  return p == null ? '—' : `₹${Math.round(p / 100).toLocaleString('en-IN')}`;
}
function riskBadge(score: number | null): { label: string; bg: string; fg: string } {
  if (score == null) return { label: 'Unscored', bg: 'rgba(255,255,255,0.12)', fg: 'rgba(255,255,255,0.6)' };
  if (score < 30) return { label: 'Low risk', bg: 'rgba(46,194,122,0.18)', fg: '#2ec27a' };
  if (score <= 60) return { label: 'Review', bg: 'rgba(245,200,66,0.2)', fg: '#F5C842' };
  return { label: 'High risk ⚠️', bg: 'rgba(232,98,58,0.18)', fg: '#E8623A' };
}
function avatarColor(id: string): string {
  const c = ['#3A9EA5', '#E8623A', '#8DC63F', '#F5C842', '#5A8A8A', '#9B7BD4'];
  let h = 0; for (const ch of id) h = (h + ch.charCodeAt(0)) % c.length;
  return c[h] ?? '#3A9EA5';
}

export function ModerationQueue() {
  const [sort, setSort] = useState<Sort>('oldest');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bulkReason, setBulkReason] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState(0);

  const utils = trpc.useUtils();
  const queue = trpc.admin.getModerationQueue.useQuery({ sort, filter, limit: 50, offset: 0 }, { refetchInterval: 60_000 });
  const recent = trpc.admin.recentlyModerated.useQuery();

  const rows = queue.data ?? [];

  const refresh = useCallback(() => {
    void utils.admin.getModerationQueue.invalidate();
    void utils.admin.recentlyModerated.invalidate();
    void utils.admin.getModerationCount.invalidate();
  }, [utils]);

  const approve = trpc.admin.approveJobWithEdit.useMutation({ onSuccess: refresh });
  const reject = trpc.admin.rejectJob.useMutation({ onSuccess: refresh });
  const bulkApprove = trpc.admin.bulkApprove.useMutation({ onSuccess: () => { setSelected(new Set()); refresh(); } });
  const bulkReject = trpc.admin.bulkReject.useMutation({ onSuccess: () => { setSelected(new Set()); setBulkReason(null); refresh(); } });

  // "Last checked" ticker.
  useEffect(() => {
    if (queue.dataUpdatedAt) setLastChecked(queue.dataUpdatedAt);
  }, [queue.dataUpdatedAt]);
  const [, force] = useState(0);
  useEffect(() => { const id = setInterval(() => force((n) => n + 1), 5000); return () => clearInterval(id); }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const row = rows[focus];
      if (!row) return;
      if (e.key === 'a') approve.mutate({ jobId: row.id });
      else if (e.key === 'r') setExpanded(row.id);
      else if (e.key === 'n') setFocus((i) => Math.min(i + 1, rows.length - 1));
      else if (e.key === 'p') setFocus((i) => Math.max(i - 1, 0));
      else if (e.key === 'e') setExpanded((x) => (x === row.id ? null : row.id));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, focus, approve]);

  function toggleSel(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const checkedAgo = lastChecked ? Math.round((Date.now() - lastChecked) / 1000) : 0;

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <h1 style={s.h1}>Moderation Queue</h1>
            {rows.length > 0 && <span style={s.countPill}>{rows.length} pending</span>}
          </div>
          <div>
            <Link href="/admin/dashboard" style={s.back}>← Dashboard</Link>
            <span style={s.checked}>Last checked: {checkedAgo}s ago</span>
          </div>
        </header>

        <div style={s.toolbar}>
          <div style={s.btnGroup}>
            {SORTS.map((o) => <button key={o.k} type="button" onClick={() => setSort(o.k)} style={{ ...s.tBtn, background: sort === o.k ? '#3A9EA5' : 'rgba(255,255,255,0.08)', color: sort === o.k ? '#fff' : 'rgba(255,255,255,0.6)' }}>{o.l}</button>)}
          </div>
          <div style={s.btnGroup}>
            {FILTERS.map((o) => <button key={o.k} type="button" onClick={() => setFilter(o.k)} style={{ ...s.tBtn, background: filter === o.k ? '#F5C842' : 'rgba(255,255,255,0.08)', color: filter === o.k ? '#0F1A1B' : 'rgba(255,255,255,0.6)' }}>{o.l}</button>)}
          </div>
        </div>
        <p style={s.shortcuts}>Shortcuts: A = Approve · R = Reject · N = Next · P = Previous · E = Expand/Collapse</p>

        {selected.size > 0 && (
          <div style={s.bulkBar}>
            <span>{selected.size} selected</span>
            <button type="button" onClick={() => bulkApprove.mutate({ jobIds: [...selected] })} disabled={bulkApprove.isPending} style={s.bulkApprove}>Approve all</button>
            <button type="button" onClick={() => setBulkReason('')} style={s.bulkReject}>Reject all</button>
            <button type="button" onClick={() => setSelected(new Set())} style={s.bulkClear}>Clear</button>
          </div>
        )}

        {bulkReason !== null && (
          <div style={s.bulkReasonBox}>
            <textarea value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder="Rejection reason for all selected (min 10 chars)…" rows={2} style={s.textarea} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setBulkReason(null)} style={s.bulkClear}>Cancel</button>
              <button type="button" disabled={bulkReason.trim().length < 10 || bulkReject.isPending} onClick={() => bulkReject.mutate({ jobIds: [...selected], reason: bulkReason.trim() })} style={s.bulkReject}>Confirm reject {selected.size}</button>
            </div>
          </div>
        )}

        {queue.isLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : rows.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 48 }}>✓</div>
            <h2 style={s.emptyTitle}>No jobs pending review</h2>
            <p style={s.emptyMl}>Review ആവശ്യമുള്ള jobs ഇല്ല</p>
            <p style={s.muted}>All caught up!</p>
          </div>
        ) : (
          rows.map((row, i) => (
            <ModerationCard
              key={row.id}
              row={row}
              focused={i === focus}
              expanded={expanded === row.id}
              checked={selected.has(row.id)}
              onToggleCheck={() => toggleSel(row.id)}
              onExpand={() => { setFocus(i); setExpanded((x) => (x === row.id ? null : row.id)); }}
              onApprove={(edits) => approve.mutate({ jobId: row.id, ...edits })}
              onReject={(reason) => reject.mutate({ jobId: row.id, reason })}
              busy={approve.isPending || reject.isPending}
            />
          ))
        )}

        {(recent.data ?? []).length > 0 && (
          <details style={s.recentBox}>
            <summary style={s.recentSummary}>Recently moderated (last 10)</summary>
            {recent.data!.map((r) => (
              <div key={r.id} style={s.recentItem}>
                <span>{r.moderationStatus === 'approved' ? '✅' : '❌'} {r.title}</span>
                <span style={s.sub}>{r.adminName ?? 'admin'} · {r.moderatedAt ? relativeTime(r.moderatedAt) : ''}</span>
              </div>
            ))}
          </details>
        )}
      </div>
    </main>
  );
}

function ModerationCard({ row, focused, expanded, checked, onToggleCheck, onExpand, onApprove, onReject, busy }: {
  row: QueueRow; focused: boolean; expanded: boolean; checked: boolean;
  onToggleCheck: () => void; onExpand: () => void;
  onApprove: (edits: { editedDescriptionEn?: string; adminNote?: string }) => void;
  onReject: (reason: string) => void; busy: boolean;
}) {
  const [descTab, setDescTab] = useState<'en' | 'ml'>('en');
  const [editEn, setEditEn] = useState(row.descriptionEn ?? '');
  const [note, setNote] = useState(row.moderationNote ?? '');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const ai = trpc.admin.analyzeJobRisk.useMutation();
  const note2 = trpc.admin.addModerationNote.useMutation();
  const rb = riskBadge(row.risk.score);
  const edited = editEn !== (row.descriptionEn ?? '');

  return (
    <div style={{ ...s.card, ...(focused ? s.cardFocus : {}) }}>
      <div style={s.cardHead} onClick={onExpand}>
        <input type="checkbox" checked={checked} onClick={(e) => e.stopPropagation()} onChange={onToggleCheck} style={s.check} />
        <span style={{ ...s.avatar, background: avatarColor(row.employerId) }}>{(row.companyName ?? '?')[0]?.toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardTitle}>{row.titleEn} <span style={s.catBadge}>{row.category ?? '—'}</span></div>
          <div style={s.sub}>{row.companyName}{row.isVerified ? ' ✓' : ' ⏳'} · {row.district ?? '—'} · {row.jobType} · {relativeTime(row.createdAt)}</div>
        </div>
        <span style={{ ...s.riskBadge, background: rb.bg, color: rb.fg }}>{rb.label} {row.risk.score}</span>
        <div style={s.quick} onClick={(e) => e.stopPropagation()}>
          <button type="button" title="Approve" onClick={() => onApprove({})} disabled={busy} style={s.iconApprove}>✓</button>
          <button type="button" title="Reject" onClick={() => { onExpand(); setRejectOpen(true); }} style={s.iconReject}>✗</button>
          <button type="button" title="Expand" onClick={onExpand} style={s.iconGhost}>{expanded ? '▲' : '▼'}</button>
        </div>
      </div>

      {expanded && (
        <div style={s.expand}>
          <div style={s.col60}>
            <h3 style={s.exTitle}>{row.titleEn}</h3>
            {row.titleMl && <p style={s.exMl}>{row.titleMl}</p>}
            <div style={s.descTabs}>
              <button type="button" onClick={() => setDescTab('en')} style={{ ...s.descTab, color: descTab === 'en' ? '#fff' : 'rgba(255,255,255,0.4)' }}>EN</button>
              {row.descriptionMl && <button type="button" onClick={() => setDescTab('ml')} style={{ ...s.descTab, color: descTab === 'ml' ? '#fff' : 'rgba(255,255,255,0.4)' }}>ML</button>}
            </div>
            {descTab === 'en' ? (
              <>
                <textarea value={editEn} onChange={(e) => setEditEn(e.target.value)} rows={8} placeholder="Admin can edit description here…" style={s.descEdit} />
                <div style={s.sub}>{editEn.length} chars{edited ? ' · edited' : ''}</div>
              </>
            ) : (
              <div style={s.descRead}>{row.descriptionMl}</div>
            )}
            <div style={s.grid}>
              <Detail k="Category" v={row.category ?? '—'} />
              <Detail k="District" v={row.district ?? '—'} />
              <Detail k="Type" v={row.jobType} />
              <Detail k="Salary" v={row.salaryDisclosed ? `${rupees(row.salaryMinPaise)}–${rupees(row.salaryMaxPaise)}` : 'Confidential'} />
              <Detail k="Experience" v={`${row.experienceMonths} mo`} />
              <Detail k="Walk-in" v={row.isWalkIn ? 'Yes' : 'No'} />
              <Detail k="Gulf exp" v={row.valuesGulf ? 'Yes' : 'No'} />
            </div>
            {(row.skills ?? []).length > 0 && <div style={s.chipRow}>{row.skills!.map((sk) => <span key={sk} style={s.chip}>{sk}</span>)}</div>}
            <div style={s.noteRow}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add internal note…" style={s.noteInput} />
              <button type="button" onClick={() => note2.mutate({ jobId: row.id, note })} disabled={note.trim().length < 5 || note2.isPending} style={s.noteBtn}>Save note</button>
            </div>
          </div>

          <div style={s.col40}>
            <div style={{ ...s.riskCard, borderColor: rb.fg }}>
              <div style={s.riskScoreLabel}>Risk Score: {row.risk.score}/100</div>
              <div style={s.riskTrack}><div style={{ ...s.riskFill, width: `${row.risk.score}%`, background: rb.fg }} /></div>
              <ul style={s.flagList}>
                {row.risk.flags.map((f, i) => (
                  <li key={i} style={s.flag}>{f.level === 'ok' ? '✅' : f.level === 'warn' ? '⚠️' : '❌'} {f.text}</li>
                ))}
                {ai.data?.flags.map((f, i) => (
                  <li key={`ai${i}`} style={s.flag}>{f.level === 'ok' ? '✅' : f.level === 'warn' ? '⚠️' : '❌'} {f.text} <span style={s.aiTag}>AI</span></li>
                ))}
              </ul>
              <div style={{ ...s.recoBox, color: rb.fg, borderColor: rb.fg }}>{(ai.data?.recommendation ?? row.risk.recommendation).toUpperCase()}</div>
              <button type="button" onClick={() => ai.mutate({ jobId: row.id })} disabled={ai.isPending} style={s.aiBtn}>{ai.isPending ? 'Analyzing…' : '✨ Run AI analysis'}</button>
            </div>

            <div style={s.empCard}>
              <div style={s.empName}>{row.companyName} {row.isVerified ? '✅' : '⏳'}</div>
              <div style={s.sub}>{row.employerTypeCode} · since {relativeTime(row.employerCreatedAt)}</div>
              <div style={s.empStats}>
                <span>Total jobs: {row.employerTotalJobs}</span>
                <span style={{ color: row.employerRejections > 2 ? '#E8623A' : undefined }}>Rejections: {row.employerRejections}</span>
                <span>Active: {row.employerActiveJobs}</span>
              </div>
              <Link href="/admin/employers" style={s.empLink}>View employer →</Link>
            </div>

            <button type="button" onClick={() => onApprove(edited || note ? { editedDescriptionEn: edited ? editEn : undefined, adminNote: note || undefined } : {})} disabled={busy} style={s.bigApprove}>✅ Approve{edited ? ' with edits' : ''}</button>
            {edited && <button type="button" onClick={() => onApprove({ editedDescriptionEn: editEn, adminNote: note || undefined })} disabled={busy} style={s.bigApproveEdit}>✏️ Approve with edits</button>}
            <button type="button" onClick={() => setRejectOpen((v) => !v)} style={s.bigReject}>❌ Reject</button>

            {rejectOpen && (
              <div style={s.rejectBox}>
                <div style={s.chipRow}>
                  {REJECT_REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} style={s.chipBtn}>{r}</button>)}
                </div>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (min 10 chars)…" rows={2} style={s.textarea} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setRejectOpen(false)} style={s.bulkClear}>Cancel</button>
                  <button type="button" disabled={reason.trim().length < 10 || busy} onClick={() => onReject(reason.trim())} style={s.bigReject}>Confirm Reject</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return <div style={s.detail}><span style={s.detailK}>{k}</span><span style={s.detailV}>{v}</span></div>;
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', padding: 'var(--space-3) var(--space-2)' },
  wrap: { maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 },
  countPill: { background: '#E8623A', color: '#fff', borderRadius: 999, padding: '3px 12px', fontSize: 13, fontWeight: 700 },
  back: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginRight: 12 },
  checked: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  toolbar: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  btnGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tBtn: { border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  shortcuts: { color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: 0 },
  bulkBar: { display: 'flex', gap: 10, alignItems: 'center', background: '#1A2B2D', borderRadius: 10, padding: '10px 16px', color: '#fff', fontSize: 14 },
  bulkApprove: { background: '#2ec27a', color: '#08311c', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, cursor: 'pointer' },
  bulkReject: { background: '#E8623A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, cursor: 'pointer' },
  bulkClear: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' },
  bulkReasonBox: { background: '#1A2B2D', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  muted: { color: 'rgba(255,255,255,0.4)', padding: 12 },
  empty: { textAlign: 'center', padding: 'var(--space-5) 0', color: '#2ec27a' },
  emptyTitle: { color: '#fff', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, margin: '8px 0 0' },
  emptyMl: { color: '#F5C842', fontSize: 14, margin: '4px 0' },
  card: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' },
  cardFocus: { borderColor: '#F5C842', borderLeft: '4px solid #F5C842' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 12, padding: 14, cursor: 'pointer' },
  check: { width: 16, height: 16, flexShrink: 0 },
  avatar: { width: 34, height: 34, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  catBadge: { fontSize: 11, color: '#7fd4da', background: 'rgba(58,158,165,0.2)', borderRadius: 6, padding: '2px 6px', marginLeft: 6 },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  riskBadge: { fontSize: 12, padding: '4px 10px', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' },
  quick: { display: 'flex', gap: 6 },
  iconApprove: { width: 32, height: 32, borderRadius: 8, border: 'none', background: '#2ec27a', color: '#08311c', fontWeight: 700, cursor: 'pointer' },
  iconReject: { width: 32, height: 32, borderRadius: 8, border: 'none', background: '#E8623A', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  iconGhost: { width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer' },
  expand: { display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' },
  col60: { minWidth: 0 },
  col40: { display: 'flex', flexDirection: 'column', gap: 10 },
  exTitle: { color: '#fff', fontSize: 17, margin: 0 },
  exMl: { color: '#F5C842', fontSize: 14, margin: '4px 0' },
  descTabs: { display: 'flex', gap: 8, marginTop: 8 },
  descTab: { background: 'none', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0' },
  descEdit: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: 10, fontSize: 13, lineHeight: 1.5, outline: 'none', resize: 'vertical' },
  descRead: { color: '#d8d8d2', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 12 },
  detail: { background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px' },
  detailK: { display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  detailV: { display: 'block', fontSize: 13, color: '#fff' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { background: 'rgba(58,158,165,0.2)', color: '#7fd4da', borderRadius: 999, padding: '4px 10px', fontSize: 12 },
  chipBtn: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 999, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  noteRow: { display: 'flex', gap: 8, marginTop: 12 },
  noteInput: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 13, outline: 'none' },
  noteBtn: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 12, cursor: 'pointer' },
  riskCard: { background: '#14201F', border: '2px solid', borderRadius: 12, padding: 14 },
  riskScoreLabel: { color: '#fff', fontWeight: 700, fontSize: 15 },
  riskTrack: { height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, margin: '8px 0' },
  riskFill: { height: '100%', borderRadius: 4 },
  flagList: { listStyle: 'none', margin: '8px 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 5 },
  flag: { color: '#d8d8d2', fontSize: 12 },
  aiTag: { fontSize: 10, background: 'rgba(58,158,165,0.3)', color: '#7fd4da', borderRadius: 4, padding: '1px 4px' },
  recoBox: { border: '1px solid', borderRadius: 8, padding: '6px 10px', textAlign: 'center', fontWeight: 700, fontSize: 13, marginTop: 6 },
  aiBtn: { marginTop: 8, width: '100%', background: 'linear-gradient(135deg,#3A9EA5,#2E8A91)', color: '#fff', border: 'none', borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  empCard: { background: '#14201F', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.08)' },
  empName: { color: '#fff', fontWeight: 600, fontSize: 14 },
  empStats: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  empLink: { color: '#3A9EA5', fontSize: 12, marginTop: 8, display: 'inline-block' },
  bigApprove: { width: '100%', background: '#3A9EA5', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  bigApproveEdit: { width: '100%', background: 'rgba(58,158,165,0.15)', color: '#3A9EA5', border: '2px solid #3A9EA5', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  bigReject: { width: '100%', background: 'rgba(232,98,58,0.1)', color: '#E8623A', border: '2px solid #E8623A', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  rejectBox: { background: '#14201F', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: 10, fontSize: 13, outline: 'none', resize: 'vertical' },
  recentBox: { background: '#1A2B2D', borderRadius: 10, padding: 12, marginTop: 8 },
  recentSummary: { color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  recentItem: { display: 'flex', justifyContent: 'space-between', gap: 12, color: '#d8d8d2', fontSize: 13, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' },
};
