import type { Metadata } from 'next';
import { GulfSetupWizard } from '@/components/gulf/GulfSetupWizard';

export const metadata: Metadata = { title: 'Gulf Return setup — ddotsjobs.com' };

export default function GulfSetupPage() {
  return <GulfSetupWizard />;
}
