import { create } from 'zustand';

// Lightweight offline cache. The last-seen jobs list is kept in memory so the
// Jobs screen can render instantly / while offline before react-query refetches.
// (Persist to expo's AsyncStorage in a follow-up for true cold-start offline.)
export interface CachedJob {
  id: string;
  slug: string | null;
  titleEn: string;
  company: string;
  district: string | null;
  salaryMinPaise: number | null;
  salaryDisclosed: boolean;
}

interface OfflineState {
  jobs: CachedJob[];
  setJobs: (jobs: CachedJob[]) => void;
}

export const useOffline = create<OfflineState>((set) => ({
  jobs: [],
  setJobs: (jobs) => set({ jobs }),
}));
