import { ImageResponse } from 'next/og';
import { and, db, eq, isNull, tables } from '@ddotsjobs/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // render on demand (CDN-cached), not at build
export const alt = 'Job on ddotsjobs.com';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function titleCase(s: string | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let title = "Kerala's job portal";
  let company = 'ddotsjobs.com';
  let district = '';
  try {
    const [row] = await db
      .select({
        titleEn: tables.jobs.titleEn,
        district: tables.jobs.district,
        displayNameEn: tables.employers.displayNameEn,
        legalNameEn: tables.employers.legalNameEn,
      })
      .from(tables.jobs)
      .innerJoin(tables.employers, eq(tables.jobs.employerId, tables.employers.id))
      .where(and(eq(tables.jobs.slug, slug), isNull(tables.jobs.deletedAt)))
      .limit(1);
    if (row) {
      title = row.titleEn;
      company = row.displayNameEn ?? row.legalNameEn;
      district = titleCase(row.district);
    }
  } catch {
    // fall back to generic copy
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAFAF8',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', height: 16, background: '#F5A800' }} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '64px 72px',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 64, fontStyle: 'italic', color: '#0F0E0C', lineHeight: 1.1 }}>
            {title}
          </div>
          <div style={{ display: 'flex', fontSize: 36, color: '#007D77', marginTop: 24 }}>
            {company}
          </div>
          {district ? (
            <div style={{ display: 'flex', fontSize: 28, color: '#55554f', marginTop: 8 }}>
              {district}, Kerala
            </div>
          ) : (
            <div style={{ display: 'flex' }} />
          )}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#9a9a92', padding: '0 72px 48px' }}>
          ddotsjobs.com
        </div>
      </div>
    ),
    { ...size },
  );
}
