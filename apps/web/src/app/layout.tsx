import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { TRPCProvider } from '@/lib/trpc/client';
import { Analytics } from '@/components/Analytics';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], display: 'swap', preload: true, variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], display: 'swap', preload: true, variable: '--font-geist-mono' });
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  preload: true,
  variable: '--font-instrument-serif',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://ddotsjobs.com'),
  title: 'ddotsjobs — Kerala Jobs',
  description: 'Kerala job portal — local, gulf, PSC and walk-in jobs.',
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logo.svg' },
    ],
    apple: '/logo.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // expose env(safe-area-inset-*) for notched devices
  themeColor: '#3A9EA5', // Ddotsmedia brand teal
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ml" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body>
        <SessionProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
