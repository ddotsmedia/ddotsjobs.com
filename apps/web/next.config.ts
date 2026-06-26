import path from 'node:path';
import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? 'https://assets.ddotsjobs.com';
const r2Host = new URL(r2Url).hostname;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
  serverExternalPackages: ['pg', 'ioredis', '@google/generative-ai', '@aws-sdk/client-s3'],
  experimental: {
    optimizePackageImports: ['@trpc/react-query', '@tanstack/react-query'],
  },
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: r2Host },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
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
