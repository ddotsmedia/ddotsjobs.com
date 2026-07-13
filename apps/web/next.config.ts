import path from 'node:path';
import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? 'https://assets.ddotsjobs.com';
const r2Host = new URL(r2Url).hostname;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Standalone server so PM2 cluster (2 instances) can share the :3100 socket.
  // `next start` does not support cluster socket sharing and EADDRINUSEs.
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
  // Workspace packages ship raw TS — let Next transpile them.
  transpilePackages: [
    '@ddotsjobs/ai',
    '@ddotsjobs/config',
    '@ddotsjobs/db',
    '@ddotsjobs/redis',
    '@ddotsjobs/storage',
  ],
  serverExternalPackages: ['pg', 'ioredis', '@google/generative-ai', '@aws-sdk/client-s3', 'isomorphic-dompurify', 'jsdom'],
  experimental: {
    optimizePackageImports: ['@trpc/react-query', '@tanstack/react-query'],
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: r2Host },
      { protocol: 'https', hostname: 'assets.ddotsjobs.com' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://assets.ddotsjobs.com",
      "connect-src 'self' https://api.greenapi.com https://api.razorpay.com https://lens.google.com",
      "frame-src https://checkout.razorpay.com https://api.razorpay.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    const immutable = { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' };
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      // Hashed build assets are already immutable via Next; this covers static
      // public files (fonts, images, icons) served from /public.
      { source: '/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico|woff|woff2|ttf|otf)', headers: [immutable] },
      { source: '/fonts/:path*', headers: [immutable] },
    ];
  },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // Workspace packages use explicit .js specifiers (NodeNext/Bundler style) that
  // point at .ts sources. Teach webpack to resolve .js -> .ts/.tsx.
  webpack(config) {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
