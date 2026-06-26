import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // render on demand (CDN-cached), not at build
export const alt = "ddotsjobs.com — Kerala's job portal";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#3A9EA5',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', gap: 18, marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: '#FFFFFF' }} />
          <div style={{ width: 56, height: 56, borderRadius: 999, background: '#F5C842' }} />
          <div style={{ width: 56, height: 56, borderRadius: 999, background: '#8DC63F' }} />
          <div style={{ width: 56, height: 56, borderRadius: 999, background: '#E8623A' }} />
        </div>
        <div style={{ fontSize: 96, fontStyle: 'italic', color: '#fff', fontWeight: 700 }}>
          ddotsjobs.com
        </div>
        <div style={{ fontSize: 40, color: '#EDF7F8', marginTop: 12 }}>
          Kerala&rsquo;s job portal
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, background: '#F5C842' }} />
      </div>
    ),
    { ...size },
  );
}
