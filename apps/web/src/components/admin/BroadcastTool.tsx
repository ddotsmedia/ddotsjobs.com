'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { relativeTime } from '@/lib/format';

type BType = 'announcement' | 'job_alert' | 'walk_in' | 'maintenance' | 'other';
const TYPES: { k: BType; icon: string; label: string }[] = [
  { k: 'announcement', icon: '📢', label: 'Announcement' },
  { k: 'job_alert', icon: '💼', label: 'Job Alert' },
  { k: 'walk_in', icon: '🚶', label: 'Walk-in' },
  { k: 'maintenance', icon: '⚙️', label: 'Maintenance' },
  { k: 'other', icon: '📋', label: 'Other' },
];
const TEMPLATES: Partial<Record<BType, string>> = {
  job_alert: '🔔 *New Jobs Alert — ddotsjobs.com*\n\n[category] jobs added today.\n\n👉 ddotsjobs.com/jobs\n\n_Kerala\'s verified job portal_',
  walk_in: '📅 *Walk-in Interview Alert*\n\nCompany: [name]\nDate: [date]\nVenue: [venue]\n\nBring: CV + certificates\n\n👉 ddotsjobs.com/jobs',
  announcement: '📢 *ddotsjobs.com Update*\n\n[your message here]\n\n_Ddotsmedia Technologies_',
};

// WhatsApp formatting -> HTML for the preview bubble.
function waToHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~(.+?)~/g, '<del>$1</del>')
    .replace(/\n/g, '<br/>');
}
function statusBadge(s: string): { label: string; color: string } {
  if (s === 'queued') return { label: '✓ Queued', color: '#3A9EA5' };
  if (s === 'scheduled') return { label: '⏰ Scheduled', color: '#F5C842' };
  if (s === 'sent') return { label: '✓ Sent', color: '#2ec27a' };
  if (s === 'cancelled') return { label: '↩️ Cancelled', color: 'rgba(255,255,255,0.5)' };
  return { label: '❌ Failed', color: '#E8623A' };
}

export function BroadcastTool() {
  const utils = trpc.useUtils();
  const groupsQ = trpc.admin.getWhatsAppGroups.useQuery();
  const stats = trpc.admin.broadcastStats.useQuery();
  const history = trpc.admin.getBroadcastHistory.useQuery({ limit: 20, offset: 0 });

  const [type, setType] = useState<BType>('announcement');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [banner, setBanner] = useState('');

  const send = trpc.admin.sendBroadcast.useMutation({
    onSuccess: (r) => {
      setBanner('scheduled' in r ? `⏰ Scheduled · ~${r.estimatedReach.toLocaleString('en-IN')} members` : `✓ Broadcast queued! Reaching ~${r.estimatedReach.toLocaleString('en-IN')} members.`);
      setConfirm(false); setMessage(''); setSelected(new Set()); setScheduleOn(false); setScheduleAt('');
      void utils.admin.getBroadcastHistory.invalidate();
      void utils.admin.broadcastStats.invalidate();
    },
    onError: (e) => { setBanner(`⚠️ ${e.message}`); setConfirm(false); },
  });
  const cancel = trpc.admin.cancelScheduledBroadcast.useMutation({ onSuccess: () => void utils.admin.getBroadcastHistory.invalidate() });

  const groups = groupsQ.data?.groups ?? [];
  const reach = useMemo(() => groups.filter((g) => selected.has(g.id)).reduce((s, g) => s + g.memberCount, 0), [groups, selected]);
  const todayCount = stats.data?.todayCount ?? 0;
  const limitReached = todayCount >= (stats.data?.dailyLimit ?? 5);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function applyType(t: BType) {
    setType(t);
    if (TEMPLATES[t] && !message.trim()) setMessage(TEMPLATES[t]!);
  }
  const minSchedule = (() => { const d = new Date(Date.now() + 5 * 60_000); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); })();
  const canSend = selected.size > 0 && message.trim().length >= 10 && !limitReached && (!scheduleOn || !!scheduleAt);

  return (
    <main style={s.main}>
      <div style={s.wrap}>
        <header style={s.head}>
          <div><h1 style={s.h1}>WhatsApp Broadcast</h1><Link href="/admin/dashboard" style={s.back}>← Dashboard</Link></div>
        </header>

        <section style={s.statsRow}>
          <div style={s.statCard}><div style={s.statValue}>{groupsQ.data?.totalGroups ?? 73}</div><div style={s.statLabel}>Total groups</div></div>
          <div style={s.statCard}><div style={s.statValue}>120K+</div><div style={s.statLabel}>Total members</div></div>
          <div style={s.statCard}><div style={{ ...s.statValue, color: limitReached ? '#E8623A' : '#3A9EA5' }}>{todayCount} / 5</div><div style={s.statLabel}>Broadcasts today</div></div>
        </section>

        {banner && <div style={{ ...s.banner, background: banner.startsWith('⚠️') ? 'rgba(232,98,58,0.15)' : 'rgba(46,194,122,0.15)', color: banner.startsWith('⚠️') ? '#E8623A' : '#2ec27a' }}>{banner}</div>}

        <div style={s.cols}>
          {/* LEFT — compose */}
          <div style={s.left}>
            <div style={s.pills}>
              {TYPES.map((t) => (
                <button key={t.k} type="button" onClick={() => applyType(t.k)} style={{ ...s.pill, background: type === t.k ? '#3A9EA5' : 'rgba(255,255,255,0.08)', color: type === t.k ? '#fff' : 'rgba(255,255,255,0.6)' }}>{t.icon} {t.label}</button>
              ))}
            </div>

            <div style={s.sectionLabel}>Send to
              <span style={s.selectLinks}>
                <button type="button" onClick={() => setSelected(new Set(groups.map((g) => g.id)))} style={s.linkBtn}>Select all</button>
                <button type="button" onClick={() => setSelected(new Set())} style={s.linkBtn}>Deselect all</button>
              </span>
            </div>
            <div style={s.groupGrid}>
              {groups.map((g) => {
                const on = selected.has(g.id);
                return (
                  <button key={g.id} type="button" onClick={() => toggle(g.id)} style={{ ...s.groupCard, borderColor: on ? '#3A9EA5' : '#2A3B3D' }}>
                    <div style={s.groupName}>{on ? '✓ ' : ''}{g.name}</div>
                    <span style={s.groupCat}>{g.category}</span>
                    <div style={s.groupMeta}>{g.memberCount.toLocaleString('en-IN')} members</div>
                    <div style={s.groupMeta}>{g.districts[0] === 'all' ? 'All Kerala' : g.districts.join(', ')}</div>
                  </button>
                );
              })}
            </div>
            <div style={s.reachBox}>{selected.size} groups · ~{reach.toLocaleString('en-IN')} members reach</div>

            <div style={s.sectionLabel}>Message
              <span style={{ ...s.charCount, color: message.length > 900 ? '#E8623A' : 'rgba(255,255,255,0.4)' }}>{message.length} / 1000</span>
            </div>
            <div style={s.tmplRow}>
              {(['job_alert', 'walk_in', 'announcement'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setMessage(TEMPLATES[t]!)} style={s.tmplBtn}>{TYPES.find((x) => x.k === t)?.label}</button>
              ))}
              <span style={s.fmtHelp} title="*bold* _italic_ ~strikethrough~">?</span>
            </div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="Type your message…" style={s.textarea} />

            <label style={s.scheduleRow}>
              <input type="checkbox" checked={scheduleOn} onChange={(e) => setScheduleOn(e.target.checked)} />
              <span>Schedule for later</span>
            </label>
            {scheduleOn && <input type="datetime-local" value={scheduleAt} min={minSchedule} onChange={(e) => setScheduleAt(e.target.value)} style={s.dateInput} />}

            <button type="button" disabled={!canSend} onClick={() => setConfirm(true)} style={{ ...s.sendBtn, opacity: canSend ? 1 : 0.5 }}>
              {scheduleOn ? '⏰ Schedule broadcast' : `📤 Send to ${selected.size} group${selected.size === 1 ? '' : 's'} now`}
            </button>
            {limitReached && <p style={s.warn}>Daily limit of 5 broadcasts reached.</p>}
          </div>

          {/* RIGHT — preview + history */}
          <div style={s.right}>
            <div style={s.sectionLabel}>Preview</div>
            <div style={s.chatArea}>
              <div style={s.bubble}>
                <span dangerouslySetInnerHTML={{ __html: waToHtml(message) || '<span style="opacity:.5">Your message preview…</span>' }} />
                <div style={s.bubbleTime}>Now ✓✓</div>
              </div>
            </div>

            <div style={s.sectionLabel}>Recent broadcasts</div>
            <div style={s.histList}>
              {(history.data ?? []).length === 0 ? <p style={s.muted}>No broadcasts yet.</p> : history.data!.map((h) => {
                const sb = statusBadge(h.status);
                return (
                  <div key={h.id} style={s.histItem}>
                    <div style={s.histTop}>
                      <span style={s.histType}>{h.broadcastType.replace(/_/g, ' ')}</span>
                      <span style={{ ...s.histStatus, color: sb.color }}>{sb.label}</span>
                    </div>
                    <div style={s.histMsg}>{h.message.slice(0, 50)}{h.message.length > 50 ? '…' : ''}</div>
                    <div style={s.sub}>{h.targetGroups.length} groups · ~{h.estimatedReach.toLocaleString('en-IN')} · {h.adminName ?? 'admin'} · {relativeTime(h.createdAt)}</div>
                    {h.status === 'scheduled' && <button type="button" onClick={() => cancel.mutate({ broadcastId: h.id })} style={s.cancelBtn}>Cancel</button>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <div style={s.overlay} onClick={() => setConfirm(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Send to {selected.size} groups?</h2>
            <p style={s.modalSub}>Estimated reach: ~{reach.toLocaleString('en-IN')} members.<br />This action cannot be undone.</p>
            <div style={s.modalActions}>
              <button type="button" onClick={() => setConfirm(false)} style={s.cancelBtn}>Cancel</button>
              <button type="button" disabled={send.isPending} onClick={() => send.mutate({ message: message.trim(), targetGroups: [...selected], broadcastType: type, scheduleAt: scheduleOn && scheduleAt ? new Date(scheduleAt).toISOString() : undefined })} style={s.confirmBtn}>
                {send.isPending ? 'Sending…' : 'Confirm Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#0F1A1B', padding: 'var(--space-3) var(--space-2)' },
  wrap: { maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: { display: 'flex', justifyContent: 'space-between' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 },
  back: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 },
  statCard: { background: '#1A2B2D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' },
  statValue: { fontSize: 26, fontWeight: 700, color: '#3A9EA5' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  banner: { borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600 },
  cols: { display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 'var(--space-2)' },
  left: { display: 'flex', flexDirection: 'column', gap: 10 },
  right: { display: 'flex', flexDirection: 'column', gap: 10 },
  pills: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  pill: { border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  sectionLabel: { color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  selectLinks: { display: 'flex', gap: 10 },
  linkBtn: { background: 'none', border: 'none', color: '#3A9EA5', fontSize: 12, cursor: 'pointer' },
  groupGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 },
  groupCard: { textAlign: 'left', background: '#1A2B2D', border: '1px solid', borderRadius: 10, padding: 12, cursor: 'pointer' },
  groupName: { color: '#fff', fontSize: 13, fontWeight: 700 },
  groupCat: { display: 'inline-block', fontSize: 10, color: '#7fd4da', background: 'rgba(58,158,165,0.2)', borderRadius: 6, padding: '1px 6px', margin: '4px 0' },
  groupMeta: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  reachBox: { background: 'rgba(58,158,165,0.1)', borderRadius: 8, padding: '8px 12px', color: '#7fd4da', fontSize: 13 },
  charCount: { fontSize: 12, fontWeight: 400 },
  tmplRow: { display: 'flex', gap: 6, alignItems: 'center' },
  tmplBtn: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  fmtHelp: { width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' },
  textarea: { background: '#1A2B2D', border: '1px solid #2A3B3D', color: '#fff', borderRadius: 12, padding: 16, minHeight: 160, fontSize: 14, lineHeight: 1.6, outline: 'none', resize: 'vertical', whiteSpace: 'pre-wrap' },
  scheduleRow: { display: 'flex', gap: 8, alignItems: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  dateInput: { background: '#1A2B2D', border: '1px solid #2A3B3D', color: '#fff', borderRadius: 8, padding: '10px 12px', fontSize: 14 },
  sendBtn: { background: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: 16, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 },
  warn: { color: '#E8623A', fontSize: 13, margin: 0 },
  chatArea: { background: '#0b141a', borderRadius: 12, padding: 16, minHeight: 120 },
  bubble: { background: '#E7F9E7', borderRadius: '0 12px 12px 12px', padding: '12px 14px', maxWidth: 280, fontSize: 13, color: '#1A1916', whiteSpace: 'pre-wrap', lineHeight: 1.5 },
  bubbleTime: { fontSize: 10, color: '#667', textAlign: 'right', marginTop: 4 },
  histList: { display: 'flex', flexDirection: 'column', gap: 8 },
  muted: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  histItem: { background: '#1A2B2D', borderRadius: 10, padding: 12 },
  histTop: { display: 'flex', justifyContent: 'space-between' },
  histType: { fontSize: 11, color: '#7fd4da', textTransform: 'capitalize' },
  histStatus: { fontSize: 12, fontWeight: 600 },
  histMsg: { color: '#fff', fontSize: 13, margin: '4px 0' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  cancelBtn: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginTop: 6 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { width: 'min(420px,100%)', background: '#14201F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 },
  modalTitle: { color: '#fff', fontSize: 20, fontFamily: 'var(--font-display)', fontStyle: 'italic', margin: 0 },
  modalSub: { color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '10px 0 0', lineHeight: 1.5 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  confirmBtn: { background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
};
