import type { Metadata } from 'next';
import { VerifyCredentials } from '@/components/seeker/VerifyCredentials';

export const metadata: Metadata = { title: 'Verify your credentials — ddotsjobs.com' };

export default function VerifyPage() {
  return <VerifyCredentials />;
}
