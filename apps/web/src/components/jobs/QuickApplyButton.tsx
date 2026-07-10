'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

interface Props {
  jobId: string;
  slug: string;
  jobTitle: string;
  companyName: string;
  salaryDisplay: string;
  category?: string | null;
  authed: boolean;
  isSeeker: boolean;
}

export function QuickApplyButton({ jobId, slug, jobTitle, companyName, salaryDisplay, category, authed, isSeeker }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const trackCta = trpc.jobs.trackApplyCta.useMutation();

  // Not logged in: prompt sign-in.
  if (!authed) {
    return (
      <Link href={`/login?next=/jobs/${slug}`} style={s.qaBtn}>⚡ Quick Apply</Link>
    );
  }
  // Employers/admins never see this (page gates it), but guard anyway.
  if (!isSeeker) return null;

  return (
    <>
      <QuickApplyGate jobId={jobId} onOpen={() => { trackCta.mutate({ jobId }); setOpen(true); }} />
      {open && (
        <QuickApplyModal jobId={jobId} jobTitle={jobTitle} companyName={companyName} salaryDisplay={salaryDisplay} category={category} onClose={() => setOpen(false)} onViewApps={() => router.push('/seeker/applications')} />
      )}
    </>
  );
}

function QuickApplyGate({ jobId, onOpen }: { jobId: string; onOpen: () => void }) {
  const check = trpc.applications.checkCanQuickApply.useQuery({ jobId });
  if (check.isLoading) return <button type="button" disabled style={{ ...s.qaBtn, ...s.disabled }}>Checking…</button>;
  const d = check.data;
  if (d?.alreadyApplied) return <button type="button" disabled style={{ ...s.qaBtn, ...s.disabled }}>✓ Applied</button>;
  if (d && !d.canQuickApply && d.completionPct < 60) {
    return (
      <Link href="/seeker/profile/setup" style={{ ...s.qaBtn, ...s.amber }} title={`Complete ${60 - d.completionPct}% more to Quick Apply`}>
        Complete Profile First
      </Link>
    );
  }
  if (d && !d.canQuickApply) return <button type="button" disabled style={{ ...s.qaBtn, ...s.disabled }} title={d.reason ?? ''}>⚡ Quick Apply</button>;
  return <button type="button" onClick={onOpen} style={s.qaBtn}>⚡ Quick Apply</button>;
}

function QuickApplyModal({ jobId, jobTitle, companyName, salaryDisplay, category, onClose, onViewApps }: {
  jobId: string; jobTitle: string; companyName: string; salaryDisplay: string; category?: string | null; onClose: () => void; onViewApps: () => void;
}) {
  const [note, setNote] = useState('');
  const [done, setDone] = useState<{ fitScore: number } | null>(null);
  const apply = trpc.applications.quickApply.useMutation({ onSuccess: (r) => setDone({ fitScore: r.fitScore }) });
  const aiNote = trpc.applications.generateCoverLetter.useMutation({ onSuccess: (r) => setNote((r.cover_letter ?? '').slice(0, 300)) });

  const fit = done?.fitScore ?? 0;
  const fitLabel = fit > 70 ? 'Strong match! 💪' : fit >= 40 ? 'Good match ✓' : 'Partial match — consider tailoring your profile';
  const waShare = `https://wa.me/?text=${encodeURIComponent(`I just applied for ${jobTitle} at ${companyName} on ddotsjobs.com!`)}`;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, ...(apply.isError ? s.modalErr : {}) }} onClick={(e) => e.stopPropagation()}>
        {!done ? (
          <>
            <div style={s.mHead}><h2 style={s.mTitle}>⚡ Quick Apply</h2><button type="button" onClick={onClose} style={s.close}>×</button></div>
            <div style={s.jobCard}>
              <strong style={{ color: '#1A1916' }}>{jobTitle}</strong>
              <div style={s.jobMeta}>{companyName}{salaryDisplay ? ` · ${salaryDisplay}` : ''}</div>
            </div>
            <div style={s.profileCard}>
              <p style={s.profileLine}>✓ Your saved profile will be shared with the employer</p>
              <p style={s.profileSub}>Name, profession, experience, certifications and fit score are sent automatically.</p>
            </div>
            <label style={s.label}>Add a quick note (optional)
              <button type="button" onClick={() => aiNote.mutate({ jobId, language: 'en' })} disabled={aiNote.isPending} style={s.aiBtn}>{aiNote.isPending ? '…' : '✨ Generate note'}</button>
            </label>
            <textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I am interested in this role and available to join immediately." rows={3} style={s.textarea} />
            <div style={s.count}>{note.length}/300{aiNote.data ? ' · AI generated — edit freely' : ''}</div>
            {apply.isError && <p style={s.err}>{apply.error.message}</p>}
            <button type="button" onClick={() => apply.mutate({ jobId, coverNote: note.trim() || undefined })} disabled={apply.isPending} style={s.confirm}>
              {apply.isPending ? 'Applying…' : 'Confirm Application →'}
            </button>
          </>
        ) : (
          <div style={s.success}>
            <div style={s.checkmark}>✓</div>
            <h2 style={s.successTitle}>Applied successfully! 🎉</h2>
            <p style={s.successMl}>Application submit ചെയ്തു! 🎉</p>
            <div style={s.fitWrap}>
              <div style={s.fitLabel}>Your match score: {fit}%</div>
              <div style={s.fitTrack}><div style={{ ...s.fitFill, width: `${fit}%` }} /></div>
              <div style={s.fitMsg}>{fitLabel}</div>
            </div>
            <button type="button" onClick={onViewApps} style={s.confirm}>View my applications →</button>
            <a href={waShare} target="_blank" rel="noopener noreferrer" style={s.shareBtn}>Share on WhatsApp</a>
            {category && <Link href={`/jobs?category=${category}`} onClick={onClose} style={s.similar}>Find similar jobs →</Link>}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  qaBtn: { display: 'block', textAlign: 'center', width: '100%', background: '#F5C842', color: '#0F1A1B', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 8 },
  disabled: { background: '#e4e4dd', color: '#9a9a92', cursor: 'not-allowed' },
  amber: { background: 'rgba(245,200,66,0.25)', color: '#9a6b00' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { width: 'min(480px,100%)', background: '#fff', borderRadius: 16, padding: 24, maxHeight: '90dvh', overflowY: 'auto' },
  modalErr: { border: '2px solid #E8623A' },
  mHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, margin: 0, color: '#1A1916' },
  close: { background: 'none', border: 'none', fontSize: 28, lineHeight: 1, cursor: 'pointer', color: '#6b6860' },
  jobCard: { background: '#F4F3EE', borderRadius: 10, padding: 12, marginTop: 12 },
  jobMeta: { color: '#6b6860', fontSize: 13, marginTop: 2 },
  profileCard: { background: 'rgba(58,158,165,0.08)', border: '1px solid rgba(58,158,165,0.2)', borderRadius: 10, padding: 12, marginTop: 12 },
  profileLine: { color: '#1A1916', fontSize: 14, margin: 0, fontWeight: 600 },
  profileSub: { color: '#6b6860', fontSize: 12, margin: '4px 0 0' },
  label: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#3a3a34', marginTop: 16, fontWeight: 600 },
  aiBtn: { background: 'none', border: 'none', color: '#3A9EA5', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  textarea: { width: '100%', border: '1px solid #d8d8d0', borderRadius: 10, padding: 12, fontSize: 14, marginTop: 6, resize: 'vertical', outline: 'none' },
  count: { fontSize: 12, color: '#9a9a92', marginTop: 4 },
  err: { color: '#E8623A', fontSize: 13, marginTop: 8 },
  confirm: { width: '100%', background: '#F5C842', color: '#0F1A1B', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 16 },
  success: { textAlign: 'center', padding: '8px 0' },
  checkmark: { width: 64, height: 64, borderRadius: '50%', background: '#e6f5ea', color: '#8DC63F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, margin: '0 auto' },
  successTitle: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, margin: '12px 0 0', color: '#1A1916' },
  successMl: { color: '#6b6860', fontSize: 14, margin: '4px 0 0' },
  fitWrap: { margin: '16px 0' },
  fitLabel: { fontWeight: 700, color: '#1A1916', fontSize: 15 },
  fitTrack: { height: 10, background: '#eee', borderRadius: 5, margin: '8px 0', overflow: 'hidden' },
  fitFill: { height: '100%', background: 'linear-gradient(90deg,#3A9EA5,#8DC63F)', borderRadius: 5 },
  fitMsg: { color: '#6b6860', fontSize: 13 },
  shareBtn: { display: 'block', textAlign: 'center', background: '#8DC63F', color: '#0F1A1B', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14, marginTop: 8, textDecoration: 'none' },
  similar: { display: 'block', color: '#3A9EA5', fontSize: 13, marginTop: 12 },
};
