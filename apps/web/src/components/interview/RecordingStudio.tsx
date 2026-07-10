'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

const TEAL = '#3A9EA5';

export function RecordingStudio({ interviewId }: { interviewId: string }) {
  const q = trpc.interview.getForCandidate.useQuery({ interviewId });
  const utils = trpc.useUtils();
  const submit = trpc.interview.submitInterview.useMutation();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const [idx, setIdx] = useState(0);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const data = q.data;
  const questions = data?.questions ?? [];
  const answered = new Set(data?.answeredIds ?? []);
  const current = questions[idx];

  const enableCamera = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640 }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamReady(true);
    } catch {
      setCamError('Camera/microphone access denied. Allow access and reload.');
    }
  }, []);

  // Stop tracks on unmount.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setRecording(false);
  }, []);

  const uploadAnswer = useCallback(
    async (questionId: string, seconds: number) => {
      setUploading(true);
      setError(null);
      try {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const fd = new FormData();
        fd.append('interviewId', interviewId);
        fd.append('questionId', questionId);
        fd.append('duration', String(seconds));
        fd.append('file', blob, 'answer.webm');
        const res = await fetch('/api/interview/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? 'upload failed');
        }
        await utils.interview.getForCandidate.invalidate({ interviewId });
      } catch (e) {
        setError((e as Error).message === 'video too large (max 30MB)' ? 'Recording too long — keep it under the time limit.' : 'Upload failed. Try again.');
      } finally {
        setUploading(false);
      }
    },
    [interviewId, utils],
  );

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !current) return;
    setError(null);
    chunksRef.current = [];
    const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const questionId = current.id;
    const limit = current.timeLimit;
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => { void uploadAnswer(questionId, elapsedRef.current); };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
    setElapsed(0);
    elapsedRef.current = 0;
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= limit) stopRecording();
    }, 1000);
  }, [current, stopRecording, uploadAnswer]);

  if (q.isLoading) return <p style={s.muted}>Loading…</p>;
  if (q.isError || !data) {
    return (
      <div style={s.wrap}><p style={s.err}>Interview not found or not yours.</p><Link href="/seeker/dashboard" style={s.link}>← Dashboard</Link></div>
    );
  }
  if (data.status === 'submitted' || data.status === 'reviewed') {
    return (
      <div style={s.wrap}>
        <div style={s.doneCard}><div style={s.doneIcon}>✓</div><h1 style={s.h1}>Interview submitted</h1><p style={s.muted}>Thanks! The employer will review your responses.</p><Link href="/seeker/dashboard" style={s.primaryBtn}>Back to dashboard</Link></div>
      </div>
    );
  }

  const allAnswered = questions.length > 0 && questions.every((qq) => answered.has(qq.id));
  const curAnswered = current ? answered.has(current.id) : false;

  return (
    <div style={s.wrap}>
      <header style={s.head}>
        <h1 style={s.h1}>Video interview</h1>
        <p style={s.sub}>{data.jobTitle} · Question {idx + 1} of {questions.length} · {answered.size} recorded</p>
      </header>

      <div style={s.stage}>
        <video ref={videoRef} muted playsInline style={s.video} />
        {!camReady && (
          <div style={s.camOverlay}>
            {camError ? <p style={s.err}>{camError}</p> : <button type="button" onClick={enableCamera} style={s.primaryBtn}>Enable camera &amp; mic</button>}
          </div>
        )}
        {recording && current && (
          <div style={s.recBadge}>● {formatT(elapsed)} / {formatT(current.timeLimit)}</div>
        )}
      </div>

      {current && (
        <div style={s.qCard}>
          <div style={s.qNum}>Q{idx + 1}{curAnswered ? ' · ✓ recorded' : ''}</div>
          <p style={s.qText}>{current.text}</p>
          <p style={s.qLimit}>Time limit: {formatT(current.timeLimit)}</p>

          <div style={s.controls}>
            {!recording ? (
              <button type="button" onClick={startRecording} disabled={!camReady || uploading} style={s.recBtn}>
                {uploading ? 'Uploading…' : curAnswered ? '● Re-record' : '● Record answer'}
              </button>
            ) : (
              <button type="button" onClick={stopRecording} style={s.stopBtn}>■ Stop</button>
            )}
          </div>
          {error && <p style={s.err}>{error}</p>}

          <div style={s.nav}>
            <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0 || recording} style={s.navBtn}>← Prev</button>
            <button type="button" onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))} disabled={idx >= questions.length - 1 || recording} style={s.navBtn}>Next →</button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => submit.mutate({ interviewId }, { onSuccess: () => void utils.interview.getForCandidate.invalidate({ interviewId }) })}
        disabled={!allAnswered || submit.isPending || recording}
        style={{ ...s.submitBtn, ...(allAnswered ? {} : s.submitDisabled) }}
      >
        {submit.isPending ? 'Submitting…' : allAnswered ? 'Submit interview' : `Record all ${questions.length} answers to submit`}
      </button>
    </div>
  );
}

function formatT(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const s: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', maxWidth: 640, margin: '0 auto', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  head: {},
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.7rem', margin: 0, color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: '4px 0 0' },
  stage: { position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#0F1A1B', borderRadius: 'var(--radius-card)', overflow: 'hidden' },
  video: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
  camOverlay: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center' },
  recBadge: { position: 'absolute', top: 10, left: 10, background: 'rgba(192,57,43,0.9)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 999 },
  qCard: { background: '#fff', border: '1px solid #efefe9', borderRadius: 'var(--radius-card)', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 8 },
  qNum: { fontSize: 12, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.05em' },
  qText: { fontSize: 17, fontWeight: 600, color: '#1a1916', margin: 0, lineHeight: 1.4 },
  qLimit: { fontSize: 13, color: '#6b6b66', margin: 0 },
  controls: { display: 'flex', gap: 10, marginTop: 4 },
  recBtn: { flex: 1, minHeight: 48, background: '#c0392b', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  stopBtn: { flex: 1, minHeight: 48, background: '#0F1A1B', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  nav: { display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4 },
  navBtn: { minHeight: 40, padding: '0 16px', background: '#fff', color: '#55554f', border: '1px solid #e2e2da', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  submitBtn: { minHeight: 50, background: 'var(--color-brand)', color: '#0f0e0c', border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  submitDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  primaryBtn: { minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' },
  doneCard: { background: '#fff', border: '1px solid #efefe9', borderRadius: 'var(--radius-card)', padding: 'var(--space-4)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  doneIcon: { width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', background: '#1d7a3a', borderRadius: '50%' },
  muted: { color: '#8a8a83', fontSize: 14 },
  err: { color: '#c0392b', fontSize: 14 },
  link: { color: TEAL, fontWeight: 600, fontSize: 14 },
};
