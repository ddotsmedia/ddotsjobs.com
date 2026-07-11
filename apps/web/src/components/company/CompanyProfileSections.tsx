import { titleCase } from '@/lib/format';

interface Profile {
  bio: string | null;
  mission: string | null;
  vision: string | null;
  culture: string | null;
  benefits: string[] | null;
  social: Record<string, string> | null;
  stories: { id: string; title: string; story: string; authorName: string | null; photoUrl: string | null }[];
  gallery: { id: string; url: string }[];
}

// Public branding sections for a company profile. Server component — pure render.
export function CompanyProfileSections({ profile }: { profile: Profile | null }) {
  if (!profile) return null;
  const { bio, mission, vision, culture, benefits, social, stories, gallery } = profile;
  const socialEntries = Object.entries(social ?? {}).filter(([, v]) => v);
  const hasAnything = bio || mission || vision || culture || (benefits?.length ?? 0) > 0 || stories.length > 0 || gallery.length > 0 || socialEntries.length > 0;
  if (!hasAnything) return null;

  return (
    <>
      {bio && (
        <section style={s.card}>
          <h2 style={s.h2}>About</h2>
          <p style={s.text}>{bio}</p>
        </section>
      )}

      {(mission || vision) && (
        <div style={s.two}>
          {mission && <section style={s.card}><h3 style={s.h3}>Mission</h3><p style={s.text}>{mission}</p></section>}
          {vision && <section style={s.card}><h3 style={s.h3}>Vision</h3><p style={s.text}>{vision}</p></section>}
        </div>
      )}

      {(benefits?.length ?? 0) > 0 && (
        <section style={s.card}>
          <h2 style={s.h2}>Benefits &amp; perks</h2>
          <div style={s.badges}>{benefits!.map((b) => <span key={b} style={s.badge}>{titleCase(b)}</span>)}</div>
        </section>
      )}

      {culture && (
        <section style={s.card}>
          <h2 style={s.h2}>Our culture</h2>
          <p style={s.text}>{culture}</p>
        </section>
      )}

      {stories.length > 0 && (
        <section>
          <h2 style={s.h2Bare}>Culture stories</h2>
          <div style={s.stories}>
            {stories.map((st) => (
              <article key={st.id} style={s.story}>
                {st.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={st.photoUrl} alt="" style={s.storyImg} />
                )}
                <div style={s.storyBody}>
                  <h3 style={s.storyTitle}>{st.title}</h3>
                  <p style={s.storyText}>{st.story}</p>
                  {st.authorName && <p style={s.storyAuthor}>— {st.authorName}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section>
          <h2 style={s.h2Bare}>Life at the company</h2>
          <div style={s.gallery}>
            {gallery.map((g) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={g.id} src={g.url} alt="" style={s.galleryImg} />
            ))}
          </div>
        </section>
      )}

      {socialEntries.length > 0 && (
        <section style={s.card}>
          <h2 style={s.h2}>Connect</h2>
          <div style={s.socialRow}>
            {socialEntries.map(([k, v]) => (
              <a key={k} href={v} target="_blank" rel="noopener noreferrer nofollow" style={s.socialLink}>{titleCase(k)} ↗</a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)' },
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'var(--space-2)' },
  h2: { fontSize: 16, fontWeight: 700, color: 'var(--color-dark)', margin: '0 0 10px' },
  h2Bare: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.4rem', margin: '0 0 10px', color: 'var(--color-dark)' },
  h3: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent)', margin: '0 0 8px' },
  text: { fontSize: 15, color: '#3a3a34', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' },
  badges: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  badge: { fontSize: 13, fontWeight: 600, color: '#1d7a3a', background: '#e6f5ea', padding: '6px 14px', borderRadius: 'var(--radius-pill)' },
  stories: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  story: { display: 'flex', gap: 14, background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', alignItems: 'flex-start' },
  storyImg: { width: 96, height: 96, flex: '0 0 auto', objectFit: 'cover', borderRadius: 12 },
  storyBody: { flex: 1, minWidth: 0 },
  storyTitle: { fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--color-dark)' },
  storyText: { fontSize: 14, color: '#55554f', lineHeight: 1.5, margin: 0 },
  storyAuthor: { fontSize: 13, color: '#9a9a92', margin: '6px 0 0', fontStyle: 'italic' },
  gallery: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 },
  galleryImg: { width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 12 },
  socialRow: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  socialLink: { fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' },
};
