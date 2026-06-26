import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ddotsjobs.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/employer', '/seeker', '/api', '/trpc'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
