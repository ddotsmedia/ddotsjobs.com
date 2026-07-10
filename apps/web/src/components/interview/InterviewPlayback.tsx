'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { formatDate, titleCase } from '@/lib/format';

const TEAL = '#3A9EA5';

export function InterviewPlayback({ interviewId }: { interviewId: string }) {
  const q = trpc.interview.getPlayback.useQuery({ interviewId });
  const utils = trpc.useUtils();
  const markReviewed = trpc.interview.markReviewed.useMutation({
    onSuccess: () => void utils.interview.getPlayback.invalidate({ interviewId }),
  });

  if (q.isLoading) return <p style={s.muted}>Loading…</p>;
  if (q.isError || !q.data) {
    return <div><Link href="/employer/dashboard" style={s.link}>← Dashboard</Link><p style={s.err}>Interview not found.</p></div>;
  }

  const d = q.data;
  const recorded = d.questions.filter((x) => x.storagePath).length;

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

      <div style={s.list}>
        {d.questions.map((x, i) => (
          <div key={x.questionId} style={s.card}>
            <div style={s.qNum}>Q{i + 1}</div>
            <p style={s.qText}>{x.text}</p>
            {x.storagePath ? (
              <video controls playsInline preload="metadata" style={s.video} src={x.storagePath} />
            ) : (
              <div style={s.noVideo}>Not recorded yet</div>
            )}
          </div>
        ))}
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
  muted: { color: '#8a8a83', fontSize: 14 },
  err: { color: '#c0392b', fontSize: 14, marginTop: 12 },
};
