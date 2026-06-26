import Link from 'next/link';
import type { JobListItem } from '@/server/routers/jobs';
import { JobCard } from '@/components/jobs/JobCard';

export function SegmentJobsPage({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: JobListItem[];
}) {
  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.h1}>{title}</h1>
          <p style={s.sub}>{subtitle}</p>
          <span style={s.count}>{items.length.toLocaleString('en-IN')} active jobs</span>
        </header>

        {items.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontWeight: 600 }}>No active jobs here yet.</p>
            <p style={{ color: '#6b6b66' }}>Set a WhatsApp alert and we&rsquo;ll notify you.</p>
            <Link href="/seeker/alerts" style={s.alertBtn}>Get job alerts</Link>
          </div>
        ) : (
          <div style={s.list}>
            {items.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 880, margin: '0 auto', padding: '0 var(--space-2)' },
  header: { padding: 'var(--space-4) 0 var(--space-2)' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(2rem,7vw,3rem)', margin: 0 },
  sub: { fontSize: 15, color: '#55554f', margin: 'var(--space-1) 0' },
  count: { fontSize: 14, color: '#6b6b66' },
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginTop: 'var(--space-2)' },
  empty: { marginTop: 'var(--space-2)', padding: 'var(--space-4)', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-card)', border: '1px dashed #d8d8d0', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' },
  alertBtn: { marginTop: 4, padding: '10px 20px', fontWeight: 600, color: '#0f0e0c', background: 'var(--color-brand)', borderRadius: 'var(--radius-pill)' },
};
