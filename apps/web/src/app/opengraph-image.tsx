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
          background: '#F5A800',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ fontSize: 96, fontStyle: 'italic', color: '#fff', fontWeight: 700 }}>
          ddotsjobs.com
        </div>
        <div style={{ fontSize: 40, color: '#0F0E0C', marginTop: 12 }}>
          Kerala&rsquo;s job portal
        </div>
      </div>
    ),
    { ...size },
  );
}
