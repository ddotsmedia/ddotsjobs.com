'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

// Peer skill endorsements for one profile. Shows every skill the profile lists
// with its endorsement count; authenticated seekers (not the owner) get a
// toggle button per skill. Read-only for everyone else.
export function SkillEndorsementsSection({
  userId,
  skills,
  canEndorse,
  loginHref,
}: {
  userId: string;
  skills: string[];
  canEndorse: boolean;
  loginHref?: string;
}) {
  const counts = trpc.endorsement.getUserSkillEndorsements.useQuery({ userId });
  const mine = trpc.endorsement.myEndorsementsFor.useQuery({ userId }, { enabled: canEndorse });
  const endorse = trpc.endorsement.endorseSkill.useMutation();
  const revoke = trpc.endorsement.revokeEndorsement.useMutation();

  const [countMap, setCountMap] = useState<Record<string, number>>({});
  const [endorsed, setEndorsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (counts.data) setCountMap(Object.fromEntries(counts.data.map((r) => [r.skillName, r.count])));
  }, [counts.data]);
  useEffect(() => {
    if (mine.data) setEndorsed(new Set(mine.data));
  }, [mine.data]);

  // Sort skills by endorsement count desc, then alphabetically.
  const ordered = useMemo(
    () => [...skills].sort((a, b) => (countMap[b] ?? 0) - (countMap[a] ?? 0) || a.localeCompare(b)),
    [skills, countMap],
  );

  async function toggle(skill: string) {
    if (!canEndorse) return;
    setError(null);
    const isOn = endorsed.has(skill);
    // optimistic
    setEndorsed((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(skill);
      else next.add(skill);
      return next;
    });
    setCountMap((prev) => ({ ...prev, [skill]: Math.max(0, (prev[skill] ?? 0) + (isOn ? -1 : 1)) }));
    try {
      const res = isOn ? await revoke.mutateAsync({ userId, skillName: skill }) : await endorse.mutateAsync({ userId, skillName: skill });
      setCountMap((prev) => ({ ...prev, [skill]: res.count }));
    } catch (e) {
      // revert on failure
      setEndorsed((prev) => {
        const next = new Set(prev);
        if (isOn) next.add(skill);
        else next.delete(skill);
        return next;
      });
      setCountMap((prev) => ({ ...prev, [skill]: Math.max(0, (prev[skill] ?? 0) + (isOn ? 1 : -1)) }));
      const msg = (e as { message?: string })?.message ?? '';
      setError(/rate limit/i.test(msg) ? 'Daily endorsement limit reached (5/day).' : 'Could not update. Try again.');
    }
  }

  if (skills.length === 0) {
    return <p style={s.empty}>No skills listed yet.</p>;
  }

  return (
    <div>
      <div style={s.grid}>
        {ordered.map((skill) => {
          const n = countMap[skill] ?? 0;
          const isOn = endorsed.has(skill);
          return (
            <div key={skill} style={{ ...s.chip, ...(isOn ? s.chipOn : {}) }}>
              <span style={s.skill}>{skill}</span>
              {n > 0 && <span style={s.count}>{n}</span>}
              {canEndorse && (
                <button
                  type="button"
                  onClick={() => toggle(skill)}
                  disabled={endorse.isPending || revoke.isPending}
                  style={{ ...s.btn, ...(isOn ? s.btnOn : {}) }}
                  aria-pressed={isOn}
                  aria-label={isOn ? `Remove endorsement for ${skill}` : `Endorse ${skill}`}
                >
                  {isOn ? '✓ Endorsed' : '+ Endorse'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p style={s.err}>{error}</p>}
      {!canEndorse && loginHref && (
        <p style={s.hint}>
          <Link href={loginHref} style={s.link}>Sign in as a job seeker</Link> to endorse these skills.
        </p>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  grid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff', border: '1px solid #e2e2da', borderRadius: 'var(--radius-pill)' },
  chipOn: { borderColor: 'var(--color-accent)', background: '#eef6f5' },
  skill: { fontSize: 14, fontWeight: 600, color: '#2a2a26' },
  count: { minWidth: 22, height: 22, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--color-accent)', borderRadius: 999 },
  btn: { minHeight: 32, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: 'var(--color-accent)', background: '#fff', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-pill)', cursor: 'pointer' },
  btnOn: { color: '#fff', background: 'var(--color-accent)' },
  empty: { color: '#8a8a83', fontSize: 14 },
  err: { color: '#c0392b', fontSize: 13, marginTop: 10 },
  hint: { color: '#6b6b66', fontSize: 13, marginTop: 12 },
  link: { color: 'var(--color-accent)', fontWeight: 600 },
};
