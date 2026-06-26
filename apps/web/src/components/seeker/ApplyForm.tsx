'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

type Mime = 'audio/webm' | 'audio/mp4' | 'audio/ogg';
const MAX_SECONDS = 120;

function pickMime(): Mime | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['audio/webm', 'audio/mp4', 'audio/ogg'] as Mime[]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

export function ApplyForm({
  jobId,
  employerQuestion,
}: {
  jobId: string;
  employerQuestion: string | null;
}) {
  const [response, setResponse] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMime, setAudioMime] = useState<Mime | null>(null);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const create = trpc.applications.create.useMutation();

  async function startRec() {
    const mime = pickMime();
    if (!mime) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        setAudioBlob(blob);
        setAudioMime(mime);
        setAudioUrl(URL.createObjectURL(blob));
      };
      rec.start();
      recorderRef.current = rec;
      startRef.current = Date.now();
      setDuration(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startRef.current) / 1000);
        setDuration(secs);
        if (secs >= MAX_SECONDS) stopRec();
      }, 250);
    } catch {
      // mic permission denied — silently disable voice note
    }
  }

  function stopRec() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    setRecording(false);
  }

  function deleteAudio() {
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioMime(null);
    setDuration(0);
  }

  async function submit() {
    let voiceNoteBase64: string | undefined;
    if (audioBlob && audioMime) voiceNoteBase64 = await blobToBase64(audioBlob);
    create.mutate({
      jobId,
      questionResponse: response.trim() || undefined,
      voiceNoteBase64,
      voiceNoteMimeType: audioMime ?? undefined,
      voiceNoteDurationS: voiceNoteBase64 ? Math.min(MAX_SECONDS, duration) : undefined,
    });
  }

  // Success
  if (create.isSuccess) {
    return (
      <div style={s.success}>
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>Application submitted</h2>
        <p style={s.successScore}>Fit score: {create.data.fitScore}/100</p>
        <p style={s.successSub}>The employer has been notified.</p>
        <div style={s.successBtns}>
          <Link href="/seeker/applications" style={s.primary}>View my applications</Link>
          <Link href="/jobs" style={s.secondary}>Find more jobs</Link>
        </div>
      </div>
    );
  }

  const alreadyApplied = create.error?.data?.code === 'CONFLICT';
  const questionRequired = Boolean(employerQuestion);
  const canSubmit = !create.isPending && (!questionRequired || response.trim().length > 0);

  return (
    <div style={s.form}>
      {employerQuestion && (
        <div style={s.qCard}>
          <p style={s.qLabel}>The employer wants to know:</p>
          <p style={s.qText}>{employerQuestion}</p>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value.slice(0, 1000))}
            placeholder="Your answer…"
            rows={4}
            style={s.textarea}
          />
          <span style={s.counter}>{response.length} / 1000</span>
        </div>
      )}

      <div style={s.voiceCard}>
        <p style={s.voiceTitle}>Add a voice note in Malayalam or English</p>
        <p style={s.voiceHint}>Candidates with voice notes get 3× more responses.</p>
        {!audioUrl ? (
          <button type="button" onClick={recording ? stopRec : startRec} style={{ ...s.recBtn, ...(recording ? s.recOn : {}) }}>
            {recording ? `■ Stop (${duration}s)` : '● Record'}
          </button>
        ) : (
          <div style={s.playRow}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={audioUrl} controls style={{ flex: 1 }} />
            <button type="button" onClick={deleteAudio} style={s.delBtn}>Delete</button>
          </div>
        )}
        {!pickMime() && <span style={s.muted}>Voice notes are not supported on this device.</span>}
      </div>

      {alreadyApplied ? (
        <div style={s.errCard}>
          You already applied to this job. <Link href="/seeker/applications" style={s.link}>View application →</Link>
        </div>
      ) : (
        create.error && <p style={s.err}>{create.error.message}</p>
      )}

      <button type="button" disabled={!canSubmit} onClick={submit} style={{ ...s.submit, opacity: canSubmit ? 1 : 0.6 }} className="ddj-apply-submit">
        {create.isPending ? 'Submitting…' : 'Submit Application'}
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  qCard: { display: 'flex', flexDirection: 'column', gap: 8, padding: 'var(--space-2)', background: '#fdf3da', border: '1px solid #f0d999', borderRadius: 'var(--radius-card)' },
  qLabel: { fontSize: 13, fontWeight: 700, color: '#9a6b00', margin: 0 },
  qText: { fontSize: 15, color: '#33332f', margin: 0 },
  textarea: { width: '100%', padding: 10, fontSize: 15, border: '1px solid #e2e2dc', borderRadius: 'var(--radius-input)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  counter: { fontSize: 12, color: '#9a9a92', alignSelf: 'flex-end' },
  voiceCard: { display: 'flex', flexDirection: 'column', gap: 8, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  voiceTitle: { fontSize: 15, fontWeight: 600, margin: 0 },
  voiceHint: { fontSize: 13, color: '#6b6b66', margin: 0 },
  recBtn: { minHeight: 48, fontSize: 15, fontWeight: 600, color: '#0f0e0c', background: '#f1f1ec', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  recOn: { background: '#fdecea', color: '#c0392b' },
  playRow: { display: 'flex', gap: 8, alignItems: 'center' },
  delBtn: { minHeight: 40, padding: '0 12px', fontSize: 13, color: '#c0392b', background: '#fff', border: '1px solid #f0d3cf', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  muted: { fontSize: 12, color: '#9a9a92' },
  errCard: { padding: 'var(--space-2)', background: '#fdecea', color: '#c0392b', borderRadius: 'var(--radius-card)', fontSize: 14 },
  err: { color: '#c0392b', fontSize: 13 },
  link: { color: 'var(--color-accent)', fontWeight: 600 },
  submit: { minHeight: 52, fontSize: 16, fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  success: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 'var(--space-4)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', textAlign: 'center' },
  successIcon: { width: 56, height: 56, borderRadius: '9999px', background: '#e6f5ea', color: '#1d7a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 },
  successTitle: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.6rem', margin: 0 },
  successScore: { fontSize: 16, fontWeight: 700, color: 'var(--color-accent)', margin: 0 },
  successSub: { fontSize: 14, color: '#55554f', margin: 0 },
  successBtns: { display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  primary: { padding: '12px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  secondary: { padding: '12px 20px', fontWeight: 600, color: '#55554f', background: '#fff', border: '1px solid #e2e2dc', borderRadius: 'var(--radius-pill)' },
};
