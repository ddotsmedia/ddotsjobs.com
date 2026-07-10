import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ChatThread } from '@/components/chat/ChatThread';

export const metadata: Metadata = { title: 'Chat — ddotsjobs.com' };
export const dynamic = 'force-dynamic';

export default async function ChatThreadPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?redirect=/chat/${conversationId}`);
  // Participant authorization is enforced by the getMessages query (NOT_FOUND
  // for non-members), so no extra server check is needed here.
  return (
    <main style={{ background: '#fff' }}>
      <ChatThread conversationId={conversationId} />
    </main>
  );
}
