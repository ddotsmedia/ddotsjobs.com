'use client';

import { useSearchParams } from 'next/navigation';
import { InterviewPrep } from './InterviewPrep';

export function InterviewPrepLoader() {
  const sp = useSearchParams();
  return <InterviewPrep initialTitle={sp.get('title') ?? ''} initialCategory={sp.get('category') ?? ''} />;
}
