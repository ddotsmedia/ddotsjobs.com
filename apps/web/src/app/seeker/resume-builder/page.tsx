import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { db, eq, tables } from '@ddotsjobs/db';
import { auth } from '@/lib/auth';
import { ResumeBuilderPro } from '@/components/seeker/ResumeBuilderPro';

export const metadata: Metadata = { title: 'Resume Builder — ddotsjobs.com', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function ResumeBuilderPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?next=/seeker/resume-builder');

  const [u] = await db
    .select({ nameEn: tables.users.nameEn })
    .from(tables.users)
    .where(eq(tables.users.id, session.user.id))
    .limit(1);

  return (
    <>
      {/* Print: isolate the resume sheet for "Save as PDF". */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
            body * { visibility: hidden !important; }
            [data-resume-print], [data-resume-print] * { visibility: visible !important; }
            [data-resume-print] { position: absolute; left: 0; top: 0; width: 100%; }
            [data-resume-noprint], .ddj-bottom-nav-spacer, nav { display: none !important; }
          }`,
        }}
      />
      <ResumeBuilderPro seekerName={u?.nameEn ?? ''} />
    </>
  );
}
