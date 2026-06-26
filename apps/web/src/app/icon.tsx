import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// Ddotsmedia 4-dot brand mark as the favicon. Satori supports flexbox only.
export default function Icon() {
  const dot = { width: 11, height: 11, borderRadius: 999, display: 'flex' };
  const row = { display: 'flex', flexDirection: 'row' as const, gap: 4, flex: 1 };
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: 5,
          background: '#FFFFFF',
        }}
      >
        <div style={row}>
          <div style={{ ...dot, background: '#3A9EA5' }} />
          <div style={{ ...dot, background: '#F5C842' }} />
        </div>
        <div style={row}>
          <div style={{ ...dot, background: '#8DC63F' }} />
          <div style={{ ...dot, background: '#E8623A' }} />
        </div>
      </div>
    ),
    size,
  );
}
