import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { SkillsList } from '@/components/skills/SkillsList';

export const metadata: Metadata = {
  title: 'Skill Assessments — ddotsjobs.com',
  description: 'Take short skill quizzes (React, Node.js, TypeScript, PostgreSQL, Kotlin) and earn verified badges on your ddotsjobs profile.',
  alternates: { canonical: 'https://ddotsjobs.com/skills' },
};
export const dynamic = 'force-dynamic';

export default async function SkillsPage() {
  const session = await auth();
  return <SkillsList authed={Boolean(session?.user)} />;
}
