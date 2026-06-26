import type { Metadata } from 'next';
import { ProfileSetupWizard } from '@/components/seeker/ProfileSetupWizard';

export const metadata: Metadata = { title: 'Set up your profile — ddotsjobs.com' };

export default function ProfileSetupPage() {
  return <ProfileSetupWizard />;
}
