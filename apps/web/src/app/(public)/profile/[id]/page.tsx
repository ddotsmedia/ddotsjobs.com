import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getServerTrpc } from '@/lib/trpc/server';
import { SkillEndorsementsSection } from '@/components/seeker/SkillEndorsementsSection';
import { initials, titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const trpc = await getServerTrpc();
  const p = await trpc.seeker.getPublicProfile({ userId: id }).catch(() => null);
  if (!p) return { title: 'Profile — ddotsjobs.com' };
  return { title: `${p.fullName ?? 'Job seeker'} — ddotsjobs.com`, robots: { index: false } };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trpc, session] = await Promise.all([getServerTrpc(), auth()]);
  const profile = await trpc.seeker.getPublicProfile({ userId: id }).catch(() => null);
  if (!profile) notFound();

  const viewer = session?.user;
  const canEndorse = Boolean(viewer) && viewer!.role === 'seeker' && viewer!.id !== profile.userId;
  const loginHref = `/login?redirect=${encodeURIComponent(`/profile/${id}`)}`;

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <span style={s.avatar} aria-hidden>{initials(profile.fullName ?? 'JS')}</span>
          <div style={{ minWidth: 0 }}>
            <h1 style={s.name}>{profile.fullName ?? 'Job seeker'}</h1>
            <div style={s.metaRow}>
              {profile.headlineEn && <span style={s.headline}>{profile.headlineEn}</span>}
              {profile.homeDistrict && <span style={s.meta}>{titleCase(profile.homeDistrict)}</span>}
              {profile.isVerifiedProfessional && <span style={s.verified}>✓ Verified</span>}
            </div>
          </div>
        </header>

        <section style={s.card}>
          <div style={s.cardHead}>
            <h2 style={s.h2}>Skills &amp; endorsements</h2>
            <span style={s.tip} title="Endorsements are peer validations of a skill. Sign in as a seeker to endorse.">ⓘ</span>
          </div>
          <SkillEndorsementsSection
            userId={profile.userId}
            skills={profile.skills}
            canEndorse={canEndorse}
            loginHref={viewer ? undefined : loginHref}
          />
        </section>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  container: { width: '100%', maxWidth: 760, margin: '0 auto', padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  header: { display: 'flex', gap: 'var(--space-2)', alignItems: 'center' },
  avatar: { flex: '0 0 auto', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--color-accent)', background: '#eef6f5', borderRadius: '9999px' },
  name: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.6rem,5vw,2.2rem)', margin: 0, color: 'var(--color-dark)' },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 6 },
  headline: { fontSize: 14, color: '#55554f' },
  meta: { fontSize: 13, color: '#6b6b66', background: '#f1f1ec', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  verified: { fontSize: 12, fontWeight: 700, color: 'var(--color-accent)' },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  h2: { fontSize: 16, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  tip: { fontSize: 13, color: '#b0ada2', cursor: 'help' },
};
