import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { CommunityFeed } from '@/components/community/CommunityFeed';

export const metadata: Metadata = {
  title: 'Community — ddotsjobs.com',
  description: "Kerala job seekers' community — share job tips, ask questions, and post success stories.",
  alternates: { canonical: 'https://ddotsjobs.com/community' },
};
export const dynamic = 'force-dynamic';

export default async function CommunityPage() {
  const session = await auth();
  return <CommunityFeed authed={Boolean(session?.user)} viewerId={session?.user?.id ?? null} />;
}
