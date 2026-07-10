'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc/client';

type Freq = 'daily' | 'weekly' | 'never';
interface Prefs {
  notifyOnMessages: boolean;
  notifyOnJobAlerts: boolean;
  notifyOnExpiry: boolean;
  notifyOnApplications: boolean;
  notifyOnEndorsements: boolean;
  digestFrequency: Freq;
}

const TEAL = '#3A9EA5';

export function EmailPreferences({ audience }: { audience: 'seeker' | 'employer' }) {
  const q = trpc.notifications.getEmailPreferences.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.notifications.updateEmailPreferences.useMutation({
    onSuccess: () => { setSaved(true); void utils.notifications.getEmailPreferences.invalidate(); },
  });

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) setPrefs({
      notifyOnMessages: q.data.notifyOnMessages,
      notifyOnJobAlerts: q.data.notifyOnJobAlerts,
      notifyOnExpiry: q.data.notifyOnExpiry,
      notifyOnApplications: q.data.notifyOnApplications,
      notifyOnEndorsements: q.data.notifyOnEndorsements,
      digestFrequency: q.data.digestFrequency as Freq,
    });
  }, [q.data]);

  if (q.isLoading || !prefs) return <p style={s.muted}>Loading…</p>;

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => { setPrefs({ ...prefs, [k]: v }); setSaved(false); };

  const toggles: { key: keyof Prefs; label: string; desc: string; show: boolean }[] = [
    { key: 'notifyOnMessages', label: 'New messages', desc: 'When someone sends you a chat message', show: true },
    { key: 'notifyOnJobAlerts', label: 'Job alerts', desc: 'Digest of new jobs matching your alerts', show: audience === 'seeker' },
    { key: 'notifyOnEndorsements', label: 'Skill endorsements', desc: 'When a peer endorses one of your skills', show: audience === 'seeker' },
    { key: 'notifyOnExpiry', label: 'Job expiry warnings', desc: 'Before one of your job posts expires', show: audience === 'employer' },
    { key: 'notifyOnApplications', label: 'New applications', desc: 'When a candidate applies to your job', show: audience === 'employer' },
  ];

  return (
    <section style={s.card}>
      <h2 style={s.h2}>Email notifications</h2>
      <p style={s.note}>Choose what ddotsjobs emails you about. You can turn everything off any time.</p>

      <div style={s.list}>
        {toggles.filter((t) => t.show).map((t) => (
          <label key={t.key} style={s.row}>
            <input type="checkbox" checked={Boolean(prefs[t.key])} onChange={(e) => set(t.key, e.target.checked as never)} style={s.checkbox} />
            <span style={s.rowBody}>
              <span style={s.rowLabel}>{t.label}</span>
              <span style={s.rowDesc}>{t.desc}</span>
            </span>
          </label>
        ))}
      </div>

      {audience === 'seeker' && (
        <div style={s.freqBlock}>
          <div style={s.rowLabel}>Job alert digest frequency</div>
          <div style={s.freqRow}>
            {(['daily', 'weekly', 'never'] as Freq[]).map((f) => (
              <label key={f} style={{ ...s.freqOpt, ...(prefs.digestFrequency === f ? s.freqOn : {}) }}>
                <input type="radio" name="freq" checked={prefs.digestFrequency === f} onChange={() => set('digestFrequency', f)} style={{ display: 'none' }} />
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={s.actions}>
        <button type="button" onClick={() => update.mutate(prefs)} disabled={update.isPending} style={s.saveBtn}>
          {update.isPending ? 'Saving…' : 'Save preferences'}
        </button>
        <button
          type="button"
          onClick={() => { const off: Prefs = { notifyOnMessages: false, notifyOnJobAlerts: false, notifyOnExpiry: false, notifyOnApplications: false, notifyOnEndorsements: false, digestFrequency: 'never' }; setPrefs(off); update.mutate(off); }}
          style={s.unsubAll}
        >
          Unsubscribe from all
        </button>
        {saved && <span style={s.savedMsg}>✓ Saved</span>}
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)' },
  h2: { fontSize: 16, fontWeight: 700, color: 'var(--color-dark)', margin: '0 0 4px' },
  note: { fontSize: 13, color: '#6b6b66', margin: '0 0 16px' },
  muted: { color: '#8a8a83', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 8px', borderRadius: 10, cursor: 'pointer', minHeight: 44 },
  checkbox: { width: 22, height: 22, marginTop: 2, accentColor: TEAL, cursor: 'pointer', flexShrink: 0 },
  rowBody: { display: 'flex', flexDirection: 'column', gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: 600, color: '#2a2a26' },
  rowDesc: { fontSize: 13, color: '#6b6b66' },
  freqBlock: { marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f1ec', display: 'flex', flexDirection: 'column', gap: 8 },
  freqRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  freqOpt: { padding: '9px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid #e2e2da', fontSize: 14, fontWeight: 600, color: '#55554f', cursor: 'pointer', minHeight: 40, display: 'inline-flex', alignItems: 'center' },
  freqOn: { background: TEAL, color: '#fff', borderColor: TEAL },
  actions: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 20 },
  saveBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  unsubAll: { background: 'none', border: 'none', color: '#c0392b', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44 },
  savedMsg: { color: '#1d7a3a', fontSize: 13, fontWeight: 600 },
};
