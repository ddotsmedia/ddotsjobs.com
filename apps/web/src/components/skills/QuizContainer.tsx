'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

type Answer = 'A' | 'B' | 'C' | 'D';

export function QuizContainer({ slug }: { slug: string }) {
  const detail = trpc.assessment.getAssessmentDetail.useQuery({ slug });
  const submit = trpc.assessment.submitAssessment.useMutation();
  const utils = trpc.useUtils();

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const result = submit.data;

  if (detail.isLoading) return <Wrap><p style={s.muted}>Loading…</p></Wrap>;
  if (detail.isError || !detail.data) return <Wrap><p style={s.err}>Assessment not found.</p><Link href="/skills" style={s.link}>← Back to Skills</Link></Wrap>;

  const { assessment, questions } = detail.data;

  // ── Results view ──
  if (result) {
    const gradeColor = result.passed ? '#8DC63F' : '#E8623A';
    const shareText = `I scored ${result.score}% on the ${assessment.title} assessment at ddotsjobs.com!`;
    return (
      <Wrap>
        <div style={{ ...s.scoreBadge, background: gradeColor }}>{result.score}%</div>
        <h1 style={s.resultTitle}>{result.passed ? 'You passed! 🎉' : 'Try again'}</h1>
        <p style={s.resultSub}>{result.passed ? `Badge added to your profile.` : `Pass mark is ${result.passingScore}%.`}</p>
        {result.passed && result.badgeEarned && <p style={s.badgeNote}>🏆 New badge earned: {assessment.title}</p>}

        <div style={s.breakdown}>
          {result.breakdown.map((b) => (
            <div key={b.number} style={{ ...s.qResult, borderColor: b.isCorrect ? '#8DC63F' : '#E8623A' }}>
              <div style={s.qResultHead}>{b.isCorrect ? '✅' : '❌'} Q{b.number}. {b.questionText}</div>
              <div style={s.qResultRow}>Your answer: <strong>{b.yourAnswer ? `${b.yourAnswer}. ${b.options[b.yourAnswer]}` : '—'}</strong></div>
              {!b.isCorrect && <div style={s.qResultRow}>Correct: <strong style={{ color: '#3A6B1A' }}>{b.correctAnswer}. {b.options[b.correctAnswer as Answer]}</strong></div>}
              {b.explanation && <div style={s.explain}>{b.explanation}</div>}
            </div>
          ))}
        </div>

        <div style={s.resultActions}>
          <button type="button" onClick={() => { submit.reset(); setAnswers({}); setIdx(0); void utils.assessment.getAssessments.invalidate(); }} style={s.retake}>Retake</button>
          <Link href="/skills" style={s.backBtn}>Back to Skills</Link>
          {result.passed && <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" style={s.share}>Share on WhatsApp</a>}
        </div>
      </Wrap>
    );
  }

  // ── Quiz view ──
  const q = questions[idx];
  if (!q) return <Wrap><p style={s.muted}>No questions available.</p></Wrap>;
  const opts: { key: Answer; text: string }[] = [
    { key: 'A', text: q.optionA }, { key: 'B', text: q.optionB }, { key: 'C', text: q.optionC }, { key: 'D', text: q.optionD },
  ];
  const selected = answers[String(q.questionNumber)];
  const isLast = idx === questions.length - 1;
  const allAnswered = questions.every((qq) => answers[String(qq.questionNumber)]);

  return (
    <Wrap>
      <div style={s.quizHead}>
        <Link href="/skills" style={s.link}>← Skills</Link>
        <span style={s.counter}>{idx + 1}/{questions.length}</span>
      </div>
      <div style={s.progressTrack}><div style={{ ...s.progressFill, width: `${((idx + 1) / questions.length) * 100}%` }} /></div>
      <h1 style={s.title}>{assessment.icon} {assessment.title}</h1>
      <div style={s.qCard}>
        <p style={s.qText}>{q.questionText}</p>
        <div style={s.opts}>
          {opts.map((o) => (
            <button key={o.key} type="button" onClick={() => setAnswers((a) => ({ ...a, [String(q.questionNumber)]: o.key }))} style={{ ...s.opt, ...(selected === o.key ? s.optActive : {}) }}>
              <span style={{ ...s.optKey, ...(selected === o.key ? s.optKeyActive : {}) }}>{o.key}</span>
              <span>{o.text}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={s.navRow}>
        <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} style={s.navBtn}>← Back</button>
        {isLast ? (
          <button type="button" disabled={!allAnswered || submit.isPending} onClick={() => submit.mutate({ slug, answers })} style={s.submitBtn}>{submit.isPending ? 'Scoring…' : 'Submit & Score'}</button>
        ) : (
          <button type="button" disabled={!selected} onClick={() => setIdx((i) => i + 1)} style={s.nextBtn}>Next →</button>
        )}
      </div>
      {submit.isError && <p style={s.err}>{submit.error.message}</p>}
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <main style={s.main}><div style={s.wrap}>{children}</div></main>;
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: '100dvh', background: '#F4F3EE', padding: 'var(--space-2)' },
  wrap: { maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 },
  muted: { color: '#9a9a92', textAlign: 'center', padding: 20 },
  err: { color: '#c0392b', fontSize: 14 },
  link: { color: '#3A9EA5', fontSize: 14, fontWeight: 600 },
  quizHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontSize: 14, fontWeight: 700, color: '#6b6860' },
  progressTrack: { height: 8, background: '#efefe9', borderRadius: 4 },
  progressFill: { height: '100%', background: '#3A9EA5', borderRadius: 4 },
  title: { fontSize: 20, margin: '4px 0 0', color: '#1A1916' },
  qCard: { background: '#fff', borderRadius: 14, border: '1px solid #efefe9', padding: 18 },
  qText: { fontSize: 18, lineHeight: 1.5, color: '#1A1916', margin: '0 0 16px' },
  opts: { display: 'flex', flexDirection: 'column', gap: 10 },
  opt: { display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#F4F3EE', border: '2px solid transparent', borderRadius: 12, padding: 14, fontSize: 15, cursor: 'pointer', minHeight: 52 },
  optActive: { borderColor: '#3A9EA5', background: 'rgba(58,158,165,0.08)' },
  optKey: { width: 28, height: 28, borderRadius: '50%', background: '#e4e4dd', color: '#6b6860', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
  optKeyActive: { background: '#3A9EA5', color: '#fff' },
  navRow: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  navBtn: { background: '#fff', border: '1px solid #d8d8d0', borderRadius: 10, padding: '12px 18px', fontSize: 14, cursor: 'pointer' },
  nextBtn: { background: '#1A1916', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  submitBtn: { background: '#F5C842', color: '#0F1A1B', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  scoreBadge: { width: 100, height: 100, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, margin: '0 auto' },
  resultTitle: { textAlign: 'center', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, margin: '8px 0 0', color: '#1A1916' },
  resultSub: { textAlign: 'center', color: '#6b6860', fontSize: 14, margin: '4px 0 0' },
  badgeNote: { textAlign: 'center', color: '#3A6B1A', fontWeight: 600, fontSize: 14 },
  breakdown: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 },
  qResult: { background: '#fff', border: '1px solid', borderLeftWidth: 4, borderRadius: 10, padding: 12 },
  qResultHead: { fontSize: 14, fontWeight: 600, color: '#1A1916', marginBottom: 6 },
  qResultRow: { fontSize: 13, color: '#3a3a34' },
  explain: { fontSize: 13, color: '#6b6860', marginTop: 6, fontStyle: 'italic' },
  resultActions: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 },
  retake: { background: '#3A9EA5', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  backBtn: { background: '#fff', border: '1px solid #d8d8d0', borderRadius: 10, padding: '12px 20px', fontSize: 14, color: '#1A1916' },
  share: { background: '#8DC63F', color: '#0F1A1B', borderRadius: 10, padding: '12px 20px', fontWeight: 700, fontSize: 14 },
};
