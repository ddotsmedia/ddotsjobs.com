import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ChatInbox } from '@/components/chat/ChatInbox';

export const metadata: Metadata = { title: 'Messages — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function ChatInboxPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/chat');
  return (
    <main style={{ background: 'var(--color-neutral)', minHeight: '100dvh' }}>
      <ChatInbox />
    </main>
  );
}
