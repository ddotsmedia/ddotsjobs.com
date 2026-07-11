'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';

const TEAL = '#3A9EA5';
const SIZES = ['1-10', '11-50', '51-200', '200+'];
const BENEFIT_OPTIONS = ['Health insurance', 'Work from home', 'Learning budget', 'Paid leave', 'Flexible hours', 'Provident fund', 'Performance bonus', 'Free meals', 'Transport', 'Gym membership'];
const SOCIAL_KEYS = ['linkedin', 'instagram', 'facebook', 'twitter', 'youtube'];
const ACCEPT = 'image/jpeg,image/png,image/webp';

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}
const mimeOf = (f: File) => (f.type === 'image/png' ? 'image/png' : f.type === 'image/webp' ? 'image/webp' : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';

export function CompanyProfileEditor() {
  const utils = trpc.useUtils();
  const q = trpc.company.getMyProfile.useQuery();
  const save = trpc.company.updateCompanyProfile.useMutation({ onSuccess: () => { setSaved(true); void utils.company.getMyProfile.invalidate(); } });
  const uploadMedia = trpc.company.uploadCompanyMedia.useMutation({ onSuccess: () => void utils.company.getMyProfile.invalidate() });
  const deleteMedia = trpc.company.deleteCompanyMedia.useMutation({ onSuccess: () => void utils.company.getMyProfile.invalidate() });
  const addStory = trpc.company.addCultureStory.useMutation({ onSuccess: () => { setStory({ title: '', body: '', author: '' }); void utils.company.getMyProfile.invalidate(); } });
  const delStory = trpc.company.deleteCultureStory.useMutation({ onSuccess: () => void utils.company.getMyProfile.invalidate() });

  const [form, setForm] = useState({ bio: '', mission: '', vision: '', culture: '', founded: '', size: '', website: '' });
  const [benefits, setBenefits] = useState<string[]>([]);
  const [social, setSocial] = useState<Record<string, string>>({});
  const [story, setStory] = useState({ title: '', body: '', author: '' });
  const [saved, setSaved] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const d = q.data;
  useEffect(() => {
    if (!d) return;
    setForm({ bio: d.bio ?? '', mission: d.mission ?? '', vision: d.vision ?? '', culture: d.culture ?? '', founded: d.founded ? String(d.founded) : '', size: d.size ?? '', website: d.website ?? '' });
    setBenefits(d.benefits ?? []);
    setSocial(d.social ?? {});
  }, [d]);

  if (q.isLoading) return <p style={s.muted}>Loading…</p>;
  if (!d) return <p style={s.muted}>Set up your employer account first.</p>;

  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };
  const toggleBenefit = (b: string) => { setBenefits((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b])); setSaved(false); };

  const onSave = () =>
    save.mutate({
      bio: form.bio, mission: form.mission, vision: form.vision, culture: form.culture,
      founded: form.founded ? Number(form.founded) : null,
      size: form.size, website: form.website, benefits,
      social: Object.fromEntries(Object.entries(social).filter(([, v]) => v.trim())),
    });

  const onUpload = async (file: File | undefined, type: 'banner' | 'photo') => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    uploadMedia.mutate({ type, base64: dataUrl, mime: mimeOf(file) });
  };

  const onAddStory = async () => {
    if (story.title.trim().length < 2 || story.body.trim().length < 10) return;
    addStory.mutate({ title: story.title.trim(), story: story.body.trim(), authorName: story.author.trim() || undefined });
  };

  return (
    <>
      <header style={s.head}>
        <div>
          <h1 style={s.h1}>Company profile</h1>
          <p style={s.sub}>How your company appears to job seekers.</p>
        </div>
        {d.slug && <Link href={`/companies/${d.slug}`} style={s.preview}>Preview ↗</Link>}
      </header>

      {/* Banner */}
      <section style={s.card}>
        <h2 style={s.h2}>Banner</h2>
        {d.banner ? <img src={d.banner} alt="" style={s.bannerImg} /> : <div style={s.bannerPlaceholder}>No banner yet</div>}
        <input ref={bannerRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => void onUpload(e.target.files?.[0], 'banner')} />
        <button type="button" onClick={() => bannerRef.current?.click()} disabled={uploadMedia.isPending} style={s.secondary}>{uploadMedia.isPending ? 'Uploading…' : 'Upload banner'}</button>
      </section>

      {/* Basics */}
      <section style={s.card}>
        <h2 style={s.h2}>About</h2>
        <label style={s.label}>Company bio<textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={4} maxLength={2000} style={s.textarea} placeholder="What your company does…" /></label>
        <div style={s.row2}>
          <label style={s.label}>Founded<input type="number" value={form.founded} onChange={(e) => set('founded', e.target.value)} min={1900} max={2100} style={s.input} placeholder="2015" /></label>
          <label style={s.label}>Team size
            <select value={form.size} onChange={(e) => set('size', e.target.value)} style={s.input}><option value="">—</option>{SIZES.map((z) => <option key={z} value={z}>{z}</option>)}</select>
          </label>
        </div>
        <label style={s.label}>Website<input type="url" value={form.website} onChange={(e) => set('website', e.target.value)} style={s.input} placeholder="https://…" /></label>
        <label style={s.label}>Mission<textarea value={form.mission} onChange={(e) => set('mission', e.target.value)} rows={2} maxLength={1000} style={s.textarea} /></label>
        <label style={s.label}>Vision<textarea value={form.vision} onChange={(e) => set('vision', e.target.value)} rows={2} maxLength={1000} style={s.textarea} /></label>
        <label style={s.label}>Culture<textarea value={form.culture} onChange={(e) => set('culture', e.target.value)} rows={3} maxLength={2000} style={s.textarea} placeholder="What it's like to work here…" /></label>
      </section>

      {/* Benefits */}
      <section style={s.card}>
        <h2 style={s.h2}>Benefits &amp; perks</h2>
        <div style={s.benefitGrid}>
          {BENEFIT_OPTIONS.map((b) => (
            <label key={b} style={s.benefit}><input type="checkbox" checked={benefits.includes(b)} onChange={() => toggleBenefit(b)} style={s.checkbox} />{b}</label>
          ))}
        </div>
      </section>

      {/* Social */}
      <section style={s.card}>
        <h2 style={s.h2}>Social links</h2>
        {SOCIAL_KEYS.map((k) => (
          <label key={k} style={s.label}>{k.charAt(0).toUpperCase() + k.slice(1)}
            <input type="url" value={social[k] ?? ''} onChange={(e) => { setSocial((p) => ({ ...p, [k]: e.target.value })); setSaved(false); }} style={s.input} placeholder="https://…" />
          </label>
        ))}
      </section>

      <div style={s.saveRow}>
        <button type="button" onClick={onSave} disabled={save.isPending} style={s.saveBtn}>{save.isPending ? 'Saving…' : 'Save profile'}</button>
        {saved && <span style={s.savedMsg}>✓ Saved</span>}
      </div>

      {/* Gallery */}
      <section style={s.card}>
        <h2 style={s.h2}>Photo gallery <span style={s.hint}>({d.gallery.length}/20)</span></h2>
        <div style={s.gallery}>
          {d.gallery.map((g) => (
            <div key={g.id} style={s.galleryItem}>
              <img src={g.url} alt="" style={s.galleryImg} />
              <button type="button" onClick={() => deleteMedia.mutate({ mediaId: g.id })} style={s.galleryDel} aria-label="Delete">×</button>
            </div>
          ))}
        </div>
        <input ref={photoRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => void onUpload(e.target.files?.[0], 'photo')} />
        <button type="button" onClick={() => photoRef.current?.click()} disabled={uploadMedia.isPending || d.gallery.length >= 20} style={s.secondary}>Add photo</button>
      </section>

      {/* Culture stories */}
      <section style={s.card}>
        <h2 style={s.h2}>Culture stories</h2>
        {d.stories.map((st) => (
          <div key={st.id} style={s.storyRow}>
            <div style={{ minWidth: 0 }}><div style={s.storyTitle}>{st.title}</div><div style={s.storyPreview}>{st.story.slice(0, 80)}…</div></div>
            <button type="button" onClick={() => delStory.mutate({ id: st.id })} style={s.linkDel}>Delete</button>
          </div>
        ))}
        <div style={s.storyForm}>
          <input value={story.title} onChange={(e) => setStory((p) => ({ ...p, title: e.target.value }))} placeholder="Story title" maxLength={200} style={s.input} />
          <textarea value={story.body} onChange={(e) => setStory((p) => ({ ...p, body: e.target.value }))} placeholder="Tell the story…" rows={3} maxLength={4000} style={s.textarea} />
          <input value={story.author} onChange={(e) => setStory((p) => ({ ...p, author: e.target.value }))} placeholder="Author (optional)" maxLength={120} style={s.input} />
          <button type="button" onClick={() => void onAddStory()} disabled={addStory.isPending} style={s.secondary}>{addStory.isPending ? 'Adding…' : 'Add story'}</button>
        </div>
      </section>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', margin: 0, color: 'var(--color-dark)' },
  sub: { fontSize: 13, color: '#6b6b66', margin: '4px 0 0' },
  preview: { fontSize: 14, fontWeight: 600, color: TEAL },
  card: { background: '#fff', borderRadius: 'var(--radius-card)', border: '1px solid #efefe9', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 10 },
  h2: { fontSize: 15, fontWeight: 700, color: 'var(--color-dark)', margin: 0 },
  hint: { fontSize: 12, color: '#9a9a92', fontWeight: 400 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#55554f' },
  input: { border: '1px solid #e2e2da', borderRadius: 8, padding: '10px 12px', fontSize: 14, minHeight: 44, fontWeight: 400 },
  textarea: { border: '1px solid #e2e2da', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', fontWeight: 400, resize: 'vertical' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  benefitGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 6 },
  benefit: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#3a3a34', minHeight: 40, cursor: 'pointer' },
  checkbox: { width: 20, height: 20, accentColor: TEAL, cursor: 'pointer' },
  saveRow: { display: 'flex', alignItems: 'center', gap: 12 },
  saveBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 48 },
  savedMsg: { color: '#1d7a3a', fontSize: 14, fontWeight: 600 },
  secondary: { alignSelf: 'flex-start', background: '#fff', color: TEAL, border: `1px solid ${TEAL}`, borderRadius: 'var(--radius-pill)', padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  bannerImg: { width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12 },
  bannerPlaceholder: { width: '100%', height: 120, background: '#f4f4ef', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a9a92', fontSize: 14 },
  gallery: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 },
  galleryItem: { position: 'relative' },
  galleryImg: { width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 10 },
  galleryDel: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1 },
  storyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f4f4ef' },
  storyTitle: { fontSize: 14, fontWeight: 700, color: '#2a2a26' },
  storyPreview: { fontSize: 13, color: '#8a8a83', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  linkDel: { background: 'none', border: 'none', color: '#c0392b', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  storyForm: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingTop: 12, borderTop: '1px solid #f1f1ec' },
  muted: { color: '#8a8a83', fontSize: 14 },
};
