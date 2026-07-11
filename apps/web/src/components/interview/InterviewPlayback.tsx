'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { formatDate, titleCase } from '@/lib/format';

const TEAL = '#3A9EA5';
const SENTIMENT: Record<string, { label: string; bg: string; fg: string }> = {
  positive: { label: 'Positive', bg: '#e6f5ea', fg: '#1d7a3a' },
  neutral: { label: 'Neutral', bg: '#f1f1ec', fg: '#6b6b66' },
  negative: { label: 'Negative', bg: '#fdecea', fg: '#c0392b' },
};

function AnswerBlock({ interviewId, x, i }: { interviewId: string; x: { questionId: string; text: string; storagePath: string | null; transcript: string | null }; i: number }) {
  const utils = trpc.useUtils();
  const save = trpc.interview.saveTranscript.useMutation({ onSuccess: () => void utils.interview.getPlayback.invalidate({ interviewId }) });
  const [t, setT] = useState(x.transcript ?? '');
  const dirty = t !== (x.transcript ?? '');

  return (
    <div style={s.card}>
      <div style={s.qNum}>Q{i + 1}</div>
      <p style={s.qText}>{x.text}</p>
      {x.storagePath ? (
        <video controls playsInline preload="metadata" style={s.video} src={x.storagePath} />
      ) : (
        <div style={s.noVideo}>Not recorded yet</div>
      )}
      <label style={s.tLabel}>Transcript</label>
      <textarea value={t} onChange={(e) => setT(e.target.value)} placeholder="Paste or type the answer transcript (used for AI analysis)…" rows={3} maxLength={8000} style={s.tArea} />
      {dirty && (
        <button type="button" onClick={() => save.mutate({ interviewId, questionId: x.questionId, transcript: t })} disabled={save.isPending} style={s.saveT}>
          {save.isPending ? 'Saving…' : 'Save transcript'}
        </button>
      )}
    </div>
  );
}

export function InterviewPlayback({ interviewId }: { interviewId: string }) {
  const q = trpc.interview.getPlayback.useQuery({ interviewId });
  const utils = trpc.useUtils();
  const markReviewed = trpc.interview.markReviewed.useMutation({ onSuccess: () => void utils.interview.getPlayback.invalidate({ interviewId }) });
  const analyze = trpc.interview.analyzeInterview.useMutation({ onSuccess: () => void utils.interview.getPlayback.invalidate({ interviewId }) });
  const [aiErr, setAiErr] = useState<string | null>(null);

  if (q.isLoading) return <p style={s.muted}>Loading…</p>;
  if (q.isError || !q.data) {
    return <div><Link href="/employer/dashboard" style={s.link}>← Dashboard</Link><p style={s.err}>Interview not found.</p></div>;
  }

  const d = q.data;
  const recorded = d.questions.filter((x) => x.storagePath).length;
  const hasTranscript = d.questions.some((x) => x.transcript && x.transcript.trim());
  const ai = d.aiAnalysis;

  const onAnalyze = () => {
    setAiErr(null);
    analyze.mutate({ interviewId }, { onError: (e) => setAiErr(/transcript/i.test(e.message) ? 'Add at least one answer transcript first.' : /budget|circuit/i.test(e.message) ? 'AI temporarily unavailable.' : 'Analysis failed. Try again.') });
  };

  return (
    <>
      <header style={s.head}>
        <div>
          <Link href="/employer/dashboard" style={s.link}>← Dashboard</Link>
          <h1 style={s.h1}>{d.candidateName ?? 'Candidate'} · {d.jobTitle}</h1>
          <p style={s.sub}>
            {titleCase(d.status)}{d.submittedAt ? ` · submitted ${formatDate(d.submittedAt as unknown as string)}` : ''} · {recorded}/{d.questions.length} recorded
          </p>
        </div>
        {d.status !== 'reviewed' && (
          <button type="button" onClick={() => markReviewed.mutate({ interviewId })} disabled={markReviewed.isPending} style={s.reviewBtn}>
            {markReviewed.isPending ? 'Saving…' : 'Mark reviewed'}
          </button>
        )}
      </header>

      {/* AI analysis */}
      <section style={s.aiCard}>
        <div style={s.aiHead}>
          <h2 style={s.aiTitle}>AI analysis</h2>
          <button type="button" onClick={onAnalyze} disabled={analyze.isPending || !hasTranscript} style={{ ...s.analyzeBtn, ...(hasTranscript ? {} : s.analyzeDisabled) }}>
            {analyze.isPending ? 'Analysing…' : ai ? 'Re-analyse' : 'Analyse transcripts'}
          </button>
        </div>
        {aiErr && <p style={s.err}>{aiErr}</p>}
        {!ai ? (
          <p style={s.muted}>{hasTranscript ? 'Not analysed yet.' : 'Add answer transcripts below, then analyse.'}</p>
        ) : (
          <>
            <div style={s.metrics}>
              <div style={s.metric}><span style={s.metricNum}>{ai.score}</span><span style={s.metricLabel}>Score</span></div>
              <div style={s.metric}><span style={s.metricNum}>{ai.engagement}</span><span style={s.metricLabel}>Engagement</span></div>
              <div style={s.metric}>
                <span style={{ ...s.sentiment, background: SENTIMENT[ai.sentiment]?.bg ?? '#f1f1ec', color: SENTIMENT[ai.sentiment]?.fg ?? '#6b6b66' }}>{SENTIMENT[ai.sentiment]?.label ?? ai.sentiment}</span>
                <span style={s.metricLabel}>Sentiment</span>
              </div>
            </div>
            <p style={s.summary}>{ai.summary}</p>
            {ai.topics.length > 0 && (
              <div style={s.topics}>{ai.topics.map((tp) => <span key={tp} style={s.topic}>{tp}</span>)}</div>
            )}
          </>
        )}
      </section>

      <div style={s.list}>
        {d.questions.map((x, i) => <AnswerBlock key={x.questionId} interviewId={interviewId} x={x} i={i} />)}
      </div>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  link: { fontSize: 13, color: TEAL, fontWeight: 600 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.7rem', margin: '6px 0 4px', color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: 0 },
  reviewBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  card: { background: '#fff', border: '1px solid #efefe9', borderRadius: 'var(--radius-card)', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 8 },
  qNum: { fontSize: 12, fontWeight: 700, color: TEAL, textTransform: 'uppercase' },
  qText: { fontSize: 16, fontWeight: 600, color: '#1a1916', margin: 0 },
  video: { width: '100%', maxHeight: 420, background: '#000', borderRadius: 10 },
  noVideo: { padding: 'var(--space-3)', textAlign: 'center', color: '#9a9a92', fontSize: 14, background: '#f7f7f2', borderRadius: 10, border: '1px dashed #d8d8d0' },
  muted: { color: '#8a8a83', fontSize: 14, margin: 0 },
  err: { color: '#c0392b', fontSize: 14, marginTop: 8 },
  aiCard: { background: '#fff', border: '1px solid #efefe9', borderRadius: 'var(--radius-card)', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 12 },
  aiHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  aiTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  analyzeBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 40 },
  analyzeDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  metrics: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  metric: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' },
  metricNum: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, fontWeight: 800, color: TEAL, lineHeight: 1 },
  metricLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8a8a83' },
  sentiment: { fontSize: 14, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-pill)' },
  summary: { fontSize: 14, color: '#3a3a34', lineHeight: 1.5, margin: 0 },
  topics: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  topic: { fontSize: 12, fontWeight: 600, color: '#55554f', background: '#f1f1ec', padding: '4px 10px', borderRadius: 'var(--radius-pill)' },
  tLabel: { fontSize: 12, fontWeight: 700, color: '#8a8a83', textTransform: 'uppercase', marginTop: 4 },
  tArea: { border: '1px solid #e2e2da', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4 },
  saveT: { alignSelf: 'flex-start', background: '#fff', color: TEAL, border: `1px solid ${TEAL}`, borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};
