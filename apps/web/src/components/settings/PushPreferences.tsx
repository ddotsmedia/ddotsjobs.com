'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc/client';

const TEAL = '#3A9EA5';
const TOGGLES = [
  { key: 'pushMessages', label: 'Messages', desc: 'New chat messages' },
  { key: 'pushJobAlerts', label: 'Job alerts', desc: 'Jobs matching your saved alerts' },
  { key: 'pushApplications', label: 'Application updates', desc: 'Status changes on your applications' },
  { key: 'pushEndorsements', label: 'Endorsements', desc: 'When someone endorses your skills' },
] as const;

type PrefKey = (typeof TOGGLES)[number]['key'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmtHour = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? ' AM' : ' PM'}`;

export function PushPreferences() {
  const utils = trpc.useUtils();
  const q = trpc.push.getPushPreferences.useQuery();
  const badge = trpc.push.getBadgeCount.useQuery();
  const update = trpc.push.updatePushPreferences.useMutation({
    onSuccess: () => void utils.push.getPushPreferences.invalidate(),
  });

  const [quietOn, setQuietOn] = useState(false);
  const [start, setStart] = useState(22);
  const [end, setEnd] = useState(8);

  useEffect(() => {
    if (q.data) {
      const on = q.data.quietStartHour !== null && q.data.quietEndHour !== null;
      setQuietOn(on);
      if (on) {
        setStart(q.data.quietStartHour!);
        setEnd(q.data.quietEndHour!);
      }
    }
  }, [q.data]);

  const setToggle = (key: PrefKey, value: boolean) => update.mutate({ [key]: value });

  const saveQuiet = (on: boolean, s: number, e: number) => {
    setQuietOn(on);
    update.mutate(on ? { quietStartHour: s, quietEndHour: e } : { quietStartHour: null, quietEndHour: null });
  };

  return (
    <div style={st.wrap}>
      <p style={st.lead}>Control push notifications sent to your mobile app. {typeof badge.data?.unread === 'number' && badge.data.unread > 0 ? `You have ${badge.data.unread} unread.` : ''}</p>

      <section style={st.card}>
        <h2 style={st.h2}>Notify me about</h2>
        {TOGGLES.map((t) => {
          const enabled = q.data ? q.data[t.key] : true;
          return (
            <label key={t.key} style={st.row}>
              <div>
                <div style={st.rowLabel}>{t.label}</div>
                <div style={st.rowDesc}>{t.desc}</div>
              </div>
              <input type="checkbox" checked={enabled} onChange={(e) => setToggle(t.key, e.target.checked)} disabled={q.isLoading} style={st.check} />
            </label>
          );
        })}
      </section>

      <section style={st.card}>
        <h2 style={st.h2}>Quiet hours</h2>
        <p style={st.rowDesc}>Pause push notifications during set hours (India time). Missed alerts still appear in-app.</p>
        <label style={st.row}>
          <div style={st.rowLabel}>Enable quiet hours</div>
          <input type="checkbox" checked={quietOn} onChange={(e) => saveQuiet(e.target.checked, start, end)} style={st.check} />
        </label>
        {quietOn && (
          <div style={st.hoursRow}>
            <label style={st.hourField}>
              <span style={st.rowDesc}>From</span>
              <select value={start} onChange={(e) => { const v = Number(e.target.value); setStart(v); saveQuiet(true, v, end); }} style={st.select}>
                {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
            </label>
            <label style={st.hourField}>
              <span style={st.rowDesc}>To</span>
              <select value={end} onChange={(e) => { const v = Number(e.target.value); setEnd(v); saveQuiet(true, start, v); }} style={st.select}>
                {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
            </label>
          </div>
        )}
      </section>

      <p style={st.note}>Push delivery requires the ddotsjobs mobile app installed and signed in on your device.</p>
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  lead: { fontSize: 14, color: '#55554f', lineHeight: 1.5, margin: 0 },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 10 },
  h2: { fontSize: 16, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44, cursor: 'pointer' },
  rowLabel: { fontSize: 14, fontWeight: 600, color: '#1a1916' },
  rowDesc: { fontSize: 12.5, color: '#8a8a83', marginTop: 2 },
  check: { width: 20, height: 20, accentColor: TEAL, cursor: 'pointer', flexShrink: 0 },
  hoursRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  hourField: { display: 'flex', flexDirection: 'column', gap: 4 },
  select: { border: '1px solid #e2e2da', borderRadius: 10, padding: '9px 12px', fontSize: 14, minHeight: 42, background: '#fff' },
  note: { fontSize: 12, color: '#8a8a83', margin: 0 },
};
