import type { NextConfig } from 'next';

const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? 'https://assets.ddotsjobs.com';
const r2Host = new URL(r2Url).hostname;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship raw TS — let Next transpile them.
  transpilePackages: [
    '@ddotsjobs/ai',
    '@ddotsjobs/config',
    '@ddotsjobs/db',
    '@ddotsjobs/redis',
  ],
  serverExternalPackages: ['pg', 'ioredis', '@anthropic-ai/sdk'],
  experimental: {
    optimizePackageImports: ['@trpc/react-query', '@tanstack/react-query'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: r2Host }],
  },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
