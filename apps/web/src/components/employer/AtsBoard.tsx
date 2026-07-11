'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { relativeTime, titleCase } from '@/lib/format';

const TEAL = '#3A9EA5';
function scoreColor(n: number) {
  if (n >= 70) return { bg: '#e6f5ea', fg: '#1d7a3a' };
  if (n >= 40) return { bg: '#fdf3da', fg: '#9a6b00' };
  return { bg: '#fdecea', fg: '#c0392b' };
}

export function AtsBoard({ jobId }: { jobId: string }) {
  const utils = trpc.useUtils();
  const q = trpc.ats.getPipeline.useQuery({ jobId });
  const move = trpc.ats.moveApplicant.useMutation({ onSuccess: () => void utils.ats.getPipeline.invalidate({ jobId }) });
  const bulkMove = trpc.ats.bulkMoveApplicants.useMutation({ onSuccess: () => { setSel(new Set()); void utils.ats.getPipeline.invalidate({ jobId }); } });

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const stages = q.data?.stages ?? [];
  const applicants = q.data?.applicants ?? [];
  const byStage = useMemo(() => {
    const m = new Map<string, typeof applicants>();
    for (const st of stages) m.set(st, []);
    for (const a of applicants) {
      if (!m.has(a.stage)) m.set(a.stage, []);
      m.get(a.stage)!.push(a);
    }
    return m;
  }, [stages, applicants]);

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (q.isLoading) return <p style={s.muted}>Loading…</p>;
  if (q.isError) return <div><Link href="/employer/jobs" style={s.link}>← My jobs</Link><p style={s.err}>Not your job.</p></div>;

  return (
    <>
      <header style={s.head}>
        <div>
          <Link href="/employer/jobs" style={s.link}>← My jobs</Link>
          <h1 style={s.h1}>Applicant pipeline</h1>
          <p style={s.sub}>{applicants.length} applicants · move a card with its stage menu</p>
        </div>
      </header>

      {sel.size > 0 && (
        <div style={s.bulkBar}>
          <span style={s.bulkCount}>{sel.size} selected</span>
          <select value={bulkStage} onChange={(e) => setBulkStage(e.target.value)} style={s.bulkSelect}>
            <option value="">Move to…</option>
            {stages.map((st) => <option key={st} value={st}>{titleCase(st)}</option>)}
          </select>
          <button type="button" disabled={!bulkStage || bulkMove.isPending} onClick={() => bulkMove.mutate({ applicationIds: [...sel], newStage: bulkStage })} style={s.bulkGo}>Move</button>
          <button type="button" onClick={() => setSel(new Set())} style={s.bulkClear}>Clear</button>
        </div>
      )}

      <div style={s.board}>
        {stages.map((st) => {
          const cards = byStage.get(st) ?? [];
          return (
            <div key={st} style={s.col}>
              <div style={s.colHead}>{titleCase(st)} <span style={s.colCount}>{cards.length}</span></div>
              <div style={s.colBody}>
                {cards.map((c) => {
                  const score = c.aiScore ?? c.fitScore;
                  const col = score != null ? scoreColor(score) : null;
                  return (
                    <div key={c.applicationId} style={s.card}>
                      <div style={s.cardTop}>
                        <input type="checkbox" checked={sel.has(c.applicationId)} onChange={() => toggle(c.applicationId)} style={s.check} />
                        <span style={s.name}>{c.name ?? 'Applicant'}</span>
                        {score != null && col && <span style={{ ...s.score, background: col.bg, color: col.fg }}>{score}</span>}
                      </div>
                      <div style={s.cardMeta}>{relativeTime(c.appliedAt)}{c.notesCount > 0 ? ` · ${c.notesCount} note${c.notesCount === 1 ? '' : 's'}` : ''}</div>
                      <div style={s.cardActions}>
                        <select value={c.stage} onChange={(e) => move.mutate({ applicationId: c.applicationId, newStage: e.target.value })} style={s.moveSel}>
                          {stages.map((sg) => <option key={sg} value={sg}>{titleCase(sg)}</option>)}
                        </select>
                        <button type="button" onClick={() => setDetailId(c.applicationId)} style={s.detailBtn}>Details</button>
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && <div style={s.emptyCol}>—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {detailId && <ApplicantDetail applicationId={detailId} onClose={() => setDetailId(null)} onChanged={() => void utils.ats.getPipeline.invalidate({ jobId })} />}
    </>
  );
}

function ApplicantDetail({ applicationId, onClose, onChanged }: { applicationId: string; onClose: () => void; onChanged: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.ats.getApplicantDetail.useQuery({ applicationId });
  const addNote = trpc.ats.addNote.useMutation({ onSuccess: () => void utils.ats.getApplicantDetail.invalidate({ applicationId }) });
  const reject = trpc.ats.rejectApplicant.useMutation({ onSuccess: () => { onChanged(); onClose(); } });
  const sendOffer = trpc.ats.sendOffer.useMutation({ onSuccess: () => { onChanged(); void utils.ats.getApplicantDetail.invalidate({ applicationId }); setOfferOpen(false); } });

  const [note, setNote] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);
  const [offer, setOffer] = useState({ position: '', salary: '', startDate: '', terms: '' });
  const d = q.data;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.mHead}><h2 style={s.mTitle}>{d?.name ?? 'Applicant'}</h2><button type="button" onClick={onClose} style={s.close}>×</button></div>
        {q.isLoading || !d ? (
          <p style={s.muted}>Loading…</p>
        ) : (
          <div style={s.mBody}>
            <div style={s.scoreRow}>
              <span style={s.stagePill}>{titleCase(d.stage)}</span>
              {d.aiScore != null && <span style={s.metaScore}>AI {d.aiScore}</span>}
              {d.fitScore != null && <span style={s.metaScore}>Fit {d.fitScore}</span>}
            </div>
            {d.cover && <><div style={s.mLabel}>Cover note</div><p style={s.mText}>{d.cover}</p></>}
            {d.aiReasons?.gaps?.length ? <><div style={s.mLabel}>Gaps (AI)</div><p style={s.mText}>{d.aiReasons.gaps.join(', ')}</p></> : null}

            <div style={s.mLabel}>Notes</div>
            {d.notes.length === 0 ? <p style={s.muted}>No notes.</p> : d.notes.map((n, i) => (
              <div key={i} style={s.noteItem}><span>{n.note}</span><span style={s.noteAt}>{relativeTime(n.at)}</span></div>
            ))}
            <div style={s.noteAdd}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" maxLength={2000} style={s.noteInput} />
              <button type="button" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate({ applicationId, note: note.trim() }, { onSuccess: () => setNote('') })} style={s.noteBtn}>Add</button>
            </div>

            <div style={s.mLabel}>Stage history</div>
            <div style={s.history}>{d.history.map((h, i) => <span key={i} style={s.histItem}>{titleCase(h.status)} · {relativeTime(h.at)}</span>)}</div>

            {offerOpen ? (
              <div style={s.offerForm}>
                <div style={s.mLabel}>Send offer</div>
                <input value={offer.position} onChange={(e) => setOffer({ ...offer, position: e.target.value })} placeholder="Position" style={s.noteInput} />
                <input value={offer.salary} onChange={(e) => setOffer({ ...offer, salary: e.target.value })} placeholder="Salary / compensation" style={s.noteInput} />
                <input value={offer.startDate} onChange={(e) => setOffer({ ...offer, startDate: e.target.value })} placeholder="Start date (optional)" style={s.noteInput} />
                <input value={offer.terms} onChange={(e) => setOffer({ ...offer, terms: e.target.value })} placeholder="Terms (optional)" style={s.noteInput} />
                <button type="button" disabled={!offer.position.trim() || sendOffer.isPending} onClick={() => sendOffer.mutate({ applicationId, position: offer.position.trim(), salary: offer.salary.trim(), startDate: offer.startDate.trim() || undefined, terms: offer.terms.trim() || undefined })} style={s.sendOfferBtn}>{sendOffer.isPending ? 'Sending…' : 'Send offer'}</button>
              </div>
            ) : (
              <div style={s.mActions}>
                <button type="button" onClick={() => setOfferOpen(true)} style={s.offerBtn}>Send offer</button>
                <button type="button" onClick={() => { if (window.confirm('Reject this applicant?')) reject.mutate({ applicationId }); }} style={s.rejectBtn}>Reject</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { marginBottom: 4 },
  link: { fontSize: 13, color: TEAL, fontWeight: 600 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.8rem', margin: '6px 0 4px', color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: 0 },
  muted: { color: '#8a8a83', fontSize: 14 },
  err: { color: '#c0392b', fontSize: 14, marginTop: 12 },
  bulkBar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fff7ed', border: '1px solid #f5d9b8', borderRadius: 10, padding: '10px 14px' },
  bulkCount: { fontSize: 13, fontWeight: 700, color: '#8a5a12' },
  bulkSelect: { border: '1px solid #e2e2da', borderRadius: 8, padding: '8px 10px', fontSize: 13, minHeight: 40, background: '#fff' },
  bulkGo: { background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 40 },
  bulkClear: { background: 'none', border: 'none', color: '#6b6b66', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 40 },
  board: { display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' },
  col: { flex: '0 0 260px', width: 260, background: '#f4f4ef', borderRadius: 'var(--radius-card)', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  colHead: { fontSize: 13, fontWeight: 700, color: '#55554f', textTransform: 'capitalize', padding: '4px 6px' },
  colCount: { color: '#9a9a92', fontWeight: 400 },
  colBody: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { background: '#fff', border: '1px solid #efefe9', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  check: { width: 18, height: 18, accentColor: TEAL, cursor: 'pointer', flexShrink: 0 },
  name: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: '#1a1916', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  score: { fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999 },
  cardMeta: { fontSize: 12, color: '#9a9a92' },
  cardActions: { display: 'flex', gap: 6, alignItems: 'center' },
  moveSel: { flex: 1, minWidth: 0, border: '1px solid #e2e2da', borderRadius: 8, padding: '6px 8px', fontSize: 12, background: '#fff' },
  detailBtn: { background: '#fff', color: TEAL, border: `1px solid ${TEAL}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  emptyCol: { textAlign: 'center', color: '#c9c7bd', fontSize: 13, padding: 12 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.5)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 },
  modal: { background: '#fff', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 520, maxHeight: '90dvh', overflowY: 'auto', padding: 'var(--space-2)' },
  mHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mTitle: { fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--color-dark)' },
  close: { fontSize: 26, background: 'none', border: 'none', cursor: 'pointer', color: '#6b6b66', lineHeight: 1 },
  mBody: { display: 'flex', flexDirection: 'column', gap: 8 },
  scoreRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  stagePill: { fontSize: 12, fontWeight: 700, color: '#55554f', background: '#f1f1ec', padding: '3px 10px', borderRadius: 999 },
  metaScore: { fontSize: 13, fontWeight: 700, color: TEAL },
  mLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#8a8a83', marginTop: 6 },
  mText: { fontSize: 14, color: '#3a3a34', margin: 0, lineHeight: 1.5 },
  noteItem: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: '#3a3a34', padding: '6px 0', borderBottom: '1px solid #f4f4ef' },
  noteAt: { color: '#b0ad9f', fontSize: 12, flexShrink: 0 },
  noteAdd: { display: 'flex', gap: 6 },
  noteInput: { flex: 1, minWidth: 0, border: '1px solid #e2e2da', borderRadius: 8, padding: '9px 12px', fontSize: 14 },
  noteBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  history: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  histItem: { fontSize: 12, color: '#6b6b66', background: '#f1f1ec', padding: '3px 10px', borderRadius: 999 },
  mActions: { display: 'flex', gap: 8, marginTop: 10 },
  offerBtn: { flex: 1, background: 'var(--color-brand)', color: '#0f0e0c', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  rejectBtn: { background: '#fff', color: '#c0392b', border: '1px solid #f0d3cf', borderRadius: 'var(--radius-pill)', padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  offerForm: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f1ec' },
  sendOfferBtn: { background: 'var(--color-brand)', color: '#0f0e0c', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
};
