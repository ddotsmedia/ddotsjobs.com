'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Stars } from './Stars';

export interface ReviewView {
  id: string;
  ratingOverall: number;
  ratingWorkCulture: number | null;
  ratingWorkLifeBalance: number | null;
  ratingPay: number | null;
  reviewText: string | null;
  reviewTextMl: string | null;
  isVerifiedEmployee: boolean;
  reviewerName: string;
  createdAt: string | Date;
  isAuthed: boolean;
}

function relativeTime(d: string | Date): string {
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  const days = Math.floor(secs / 86400);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const SUB = [
  { key: 'ratingWorkCulture', label: 'Culture' },
  { key: 'ratingWorkLifeBalance', label: 'Work-life' },
  { key: 'ratingPay', label: 'Pay' },
] as const;

export function ReviewCard({ review }: { review: ReviewView }) {
  const router = useRouter();
  const hasMl = Boolean(review.reviewTextMl);
  const hasEn = Boolean(review.reviewText);
  const [lang, setLang] = useState<'en' | 'ml'>(hasEn ? 'en' : 'ml');
  const [flagOpen, setFlagOpen] = useState(false);
  const [reason, setReason] = useState('');
  const flag = trpc.reviews.flag.useMutation();

  const body = lang === 'en' ? review.reviewText : review.reviewTextMl;

  return (
    <article style={s.card}>
      <div style={s.top}>
        <Stars value={review.ratingOverall} />
        <span style={s.date}>{relativeTime(review.createdAt)}</span>
      </div>

      <div style={s.who}>
        <span style={s.name}>{review.reviewerName}</span>
        {review.isVerifiedEmployee && <span style={s.verifiedChip}>✓ Verified employee</span>}
      </div>

      {hasEn && hasMl && (
        <div style={s.tabs}>
          <button type="button" onClick={() => setLang('en')} style={{ ...s.tab, ...(lang === 'en' ? s.tabOn : {}) }}>English</button>
          <button type="button" onClick={() => setLang('ml')} style={{ ...s.tab, ...(lang === 'ml' ? s.tabOn : {}) }}>മലയാളം</button>
        </div>
      )}
      {body && <p style={s.body}>{body}</p>}

      <div style={s.subRow}>
        {SUB.map((sub) => {
          const v = review[sub.key];
          if (v == null) return null;
          return (
            <div key={sub.key} style={s.subItem}>
              <span style={s.subLabel}>{sub.label}</span>
              <span style={s.subTrack}><span style={{ ...s.subBar, width: `${(v / 5) * 100}%` }} /></span>
              <span style={s.subVal}>{v}</span>
            </div>
          );
        })}
      </div>

      <div style={s.flagRow}>
        {flag.data?.flagged ? (
          <span style={s.flagged}>Reported — thank you</span>
        ) : review.isAuthed ? (
          flagOpen ? (
            <span style={s.flagForm}>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (min 10 chars)" style={s.flagInput} />
              <button type="button" disabled={reason.trim().length < 10 || flag.isPending} onClick={() => flag.mutate({ reviewId: review.id, reason: reason.trim() })} style={s.flagSend}>Submit</button>
            </span>
          ) : (
            <button type="button" onClick={() => setFlagOpen(true)} style={s.flagLink}>Flag review</button>
          )
        ) : (
          <button type="button" onClick={() => router.push('/login')} style={s.flagLink}>Flag review</button>
        )}
      </div>
    </article>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { display: 'flex', flexDirection: 'column', gap: 8, padding: 'var(--space-2)', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: '#9a9a92' },
  who: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: 600, color: 'var(--color-dark)' },
  verifiedChip: { fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', background: '#e6f4f3', padding: '2px 8px', borderRadius: 'var(--radius-pill)' },
  tabs: { display: 'flex', gap: 6 },
  tab: { fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid #e2e2dc', background: '#fff', cursor: 'pointer' },
  tabOn: { background: 'var(--color-dark)', color: '#fff', borderColor: 'var(--color-dark)' },
  body: { fontSize: 14, color: '#33332f', lineHeight: 1.5, margin: 0 },
  subRow: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' },
  subItem: { display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 120px' },
  subLabel: { fontSize: 12, color: '#6b6b66', width: 64, flex: '0 0 64px' },
  subTrack: { flex: 1, height: 6, background: '#f1f1ec', borderRadius: 'var(--radius-pill)', overflow: 'hidden' },
  subBar: { display: 'block', height: '100%', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
  subVal: { fontSize: 12, color: '#55554f', width: 14, flex: '0 0 14px', textAlign: 'right' },
  flagRow: { display: 'flex', justifyContent: 'flex-end' },
  flagLink: { fontSize: 12, color: '#9a9a92', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' },
  flagForm: { display: 'flex', gap: 6 },
  flagInput: { fontSize: 12, padding: '4px 8px', border: '1px solid #e2e2dc', borderRadius: 8 },
  flagSend: { fontSize: 12, fontWeight: 600, padding: '4px 10px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  flagged: { fontSize: 12, color: 'var(--color-accent)' },
};
