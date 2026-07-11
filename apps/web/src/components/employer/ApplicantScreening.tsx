'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { relativeTime, titleCase } from '@/lib/format';

const TEAL = '#3A9EA5';

const DEFAULT_QUESTIONS = [
  { text: 'Tell us about yourself and why you are interested in this role.', timeLimit: 120 },
  { text: 'Describe your most relevant experience for this position.', timeLimit: 120 },
  { text: 'Why should we hire you?', timeLimit: 90 },
];

function scoreColor(n: number): { bg: string; fg: string } {
  if (n >= 70) return { bg: '#e6f5ea', fg: '#1d7a3a' };
  if (n >= 40) return { bg: '#fdf3da', fg: '#9a6b00' };
  return { bg: '#fdecea', fg: '#c0392b' };
}

export function ApplicantScreening({ jobId }: { jobId: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.screening.getApplicantScores.useQuery({ jobId });
  const score = trpc.screening.scoreApplication.useMutation();
  const invite = trpc.interview.createInterview.useMutation({
    onSuccess: (r) => router.push(`/employer/interviews/${r.interviewId}`),
  });

  const [onlyHigh, setOnlyHigh] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = q.data?.applicants ?? [];
  const view = useMemo(() => (onlyHigh ? rows.filter((r) => (r.aiScore ?? -1) >= 70) : rows), [rows, onlyHigh]);
  const unscored = rows.filter((r) => r.aiScore == null);

  const scoreOne = async (applicationId: string) => {
    setError(null);
    try {
      await score.mutateAsync({ applicationId });
      await utils.screening.getApplicantScores.invalidate({ jobId });
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setError(/rate limit/i.test(msg) ? 'Daily scoring limit reached.' : /budget|circuit/i.test(msg) ? 'AI temporarily unavailable (budget).' : 'Scoring failed. Try again.');
    }
  };

  const scoreAll = async () => {
    setError(null);
    const ids = unscored.map((r) => r.applicationId);
    setBulk({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try {
        await score.mutateAsync({ applicationId: ids[i]! });
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? '';
        setError(/rate limit/i.test(msg) ? 'Daily scoring limit reached.' : 'Some applicants could not be scored.');
        break;
      }
      setBulk({ done: i + 1, total: ids.length });
    }
    await utils.screening.getApplicantScores.invalidate({ jobId });
    setBulk(null);
  };

  return (
    <>
      <header style={s.head}>
        <div>
          <Link href="/employer/jobs" style={s.back}>← My jobs</Link>
          <h1 style={s.h1}>Applicants{q.data?.jobTitle ? ` · ${q.data.jobTitle}` : ''}</h1>
          <p style={s.sub}>AI-ranked by fit. Scores are on-demand. <Link href={`/employer/jobs/${jobId}/ats`} style={s.back}>Open pipeline →</Link></p>
        </div>
      </header>

      <div style={s.controls}>
        <label style={s.check}>
          <input type="checkbox" checked={onlyHigh} onChange={(e) => setOnlyHigh(e.target.checked)} style={s.checkbox} />
          Show only 70+ match
        </label>
        {unscored.length > 0 && (
          <button type="button" onClick={scoreAll} disabled={Boolean(bulk)} style={s.scoreAll}>
            {bulk ? `Scoring ${bulk.done}/${bulk.total}…` : `Score ${unscored.length} unscored with AI`}
          </button>
        )}
      </div>
      {error && <p style={s.err}>{error}</p>}

      {q.isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <div style={s.empty}><p style={{ fontWeight: 600 }}>No applicants yet.</p></div>
      ) : (
        <div style={s.list}>
          {view.map((r) => {
            const scored = r.aiScore != null;
            const col = scoreColor(r.aiScore ?? 0);
            const isOpen = expanded === r.applicationId;
            return (
              <div key={r.applicationId} style={s.card}>
                <div style={s.cardMain}>
                  <div style={{ ...s.scoreBadge, ...(scored ? { background: col.bg, color: col.fg } : s.noScore) }}>
                    {scored ? r.aiScore : '—'}
                  </div>
                  <div style={s.info}>
                    <div style={s.name}>{r.name ?? 'Applicant'}</div>
                    <div style={s.metaRow}>
                      <span>{titleCase(r.profession ?? '')}</span>
                      <span style={s.dot}>·</span>
                      <span>{titleCase(r.statusCode)}</span>
                      <span style={s.dot}>·</span>
                      <span>{relativeTime(r.appliedAt)}</span>
                      {r.fitScore != null && <><span style={s.dot}>·</span><span>fit {r.fitScore}</span></>}
                    </div>
                    {scored && r.reasoning && (
                      <button type="button" onClick={() => setExpanded(isOpen ? null : r.applicationId)} style={s.reasonToggle}>
                        {isOpen ? 'Hide reasons' : 'Why this score?'}
                      </button>
                    )}
                  </div>
                  <div style={s.actions}>
                    <button type="button" onClick={() => scoreOne(r.applicationId)} disabled={score.isPending || Boolean(bulk)} style={s.scoreBtn}>
                      {scored ? 'Re-score' : 'Score'}
                    </button>
                    <button type="button" onClick={() => invite.mutate({ jobId, candidateUserId: r.userId, questions: DEFAULT_QUESTIONS })} disabled={invite.isPending} style={s.interviewBtn}>
                      🎥 Interview
                    </button>
                  </div>
                </div>
                {isOpen && scored && (
                  <div style={s.reasons}>
                    <p style={s.reasoning}>{r.reasoning}</p>
                    {(r.matchReasons?.skills?.length ?? 0) > 0 && (
                      <div style={s.tagRow}><span style={s.tagLabel}>Matches:</span>{r.matchReasons!.skills.map((sk) => <span key={sk} style={{ ...s.tag, ...s.tagGood }}>{sk}</span>)}</div>
                    )}
                    {(r.matchReasons?.gaps?.length ?? 0) > 0 && (
                      <div style={s.tagRow}><span style={s.tagLabel}>Gaps:</span>{r.matchReasons!.gaps.map((g) => <span key={g} style={{ ...s.tag, ...s.tagBad }}>{g}</span>)}</div>
                    )}
                    {r.matchReasons?.experience && <p style={s.line}><strong>Experience:</strong> {r.matchReasons.experience}</p>}
                    {r.matchReasons?.education && <p style={s.line}><strong>Education:</strong> {r.matchReasons.education}</p>}
                  </div>
                )}
              </div>
            );
          })}
          {view.length === 0 && <p style={s.muted}>No applicants match the filter.</p>}
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { marginBottom: 4 },
  back: { fontSize: 13, color: TEAL, fontWeight: 600 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.8rem', margin: '6px 0 4px', color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: 0 },
  controls: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  check: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#55554f', minHeight: 44, cursor: 'pointer' },
  checkbox: { width: 20, height: 20, accentColor: TEAL, cursor: 'pointer' },
  scoreAll: { background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  err: { color: '#c0392b', fontSize: 13 },
  muted: { color: '#8a8a83', fontSize: 14, padding: 8 },
  empty: { padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)' },
  cardMain: { display: 'flex', gap: 14, alignItems: 'center' },
  scoreBadge: { flex: '0 0 auto', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, fontWeight: 800, borderRadius: 14 },
  noScore: { background: '#f1f1ec', color: '#b0ad9f' },
  info: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  name: { fontSize: 16, fontWeight: 700, color: 'var(--color-dark)' },
  metaRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: '#6b6b66' },
  dot: { color: '#c9c7bd' },
  reasonToggle: { alignSelf: 'flex-start', background: 'none', border: 'none', color: TEAL, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '2px 0' },
  actions: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6 },
  scoreBtn: { background: '#fff', color: TEAL, border: `1px solid ${TEAL}`, borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 40, whiteSpace: 'nowrap' },
  interviewBtn: { background: '#fff', color: '#55554f', border: '1px solid #e2e2da', borderRadius: 'var(--radius-pill)', padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 40, whiteSpace: 'nowrap' },
  reasons: { marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f1ec', display: 'flex', flexDirection: 'column', gap: 8 },
  reasoning: { fontSize: 14, color: '#3a3a34', margin: 0, lineHeight: 1.5 },
  tagRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  tagLabel: { fontSize: 12, fontWeight: 700, color: '#6b6b66' },
  tag: { fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  tagGood: { background: '#e6f5ea', color: '#1d7a3a' },
  tagBad: { background: '#fdecea', color: '#c0392b' },
  line: { fontSize: 13, color: '#55554f', margin: 0 },
};
