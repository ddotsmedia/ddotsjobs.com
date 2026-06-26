// Shared display constants. district values mirror the DB `district` enum.

export const DISTRICTS = [
  { value: 'thiruvananthapuram', label: 'Thiruvananthapuram' },
  { value: 'kollam', label: 'Kollam' },
  { value: 'pathanamthitta', label: 'Pathanamthitta' },
  { value: 'alappuzha', label: 'Alappuzha' },
  { value: 'kottayam', label: 'Kottayam' },
  { value: 'idukki', label: 'Idukki' },
  { value: 'ernakulam', label: 'Ernakulam' },
  { value: 'thrissur', label: 'Thrissur' },
  { value: 'palakkad', label: 'Palakkad' },
  { value: 'malappuram', label: 'Malappuram' },
  { value: 'kozhikode', label: 'Kozhikode' },
  { value: 'wayanad', label: 'Wayanad' },
  { value: 'kannur', label: 'Kannur' },
  { value: 'kasaragod', label: 'Kasaragod' },
] as const;

// Homepage sector grid — categorySlug -> label.
export const SECTORS = [
  { slug: 'nursing', label: 'Nursing' },
  { slug: 'it', label: 'IT' },
  { slug: 'teaching', label: 'Teaching' },
  { slug: 'government', label: 'Government' },
  { slug: 'gulf_return', label: 'Gulf Return' },
  { slug: 'banking', label: 'Banking' },
  { slug: 'construction', label: 'Construction' },
  { slug: 'retail', label: 'Retail' },
] as const;

// /jobs category checkboxes (sectors + Other).
export const CATEGORIES_UI = [...SECTORS, { slug: 'other', label: 'Other' }] as const;

// /jobs job-type checkboxes (subset of the job_type enum surfaced to seekers).
export const JOB_TYPES_UI = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'internship', label: 'Internship' },
] as const;

// Salary slider (rupees). Convert to paise (×100) before querying.
export const SALARY_MIN_RUPEES = 10_000;
export const SALARY_MAX_RUPEES = 100_000;
export const SALARY_STEP_RUPEES = 5_000;

// Category SEO pages: URL param -> DB category_slug + display name.
export const CATEGORY_SEO = [
  { param: 'nursing', db: 'nursing', display: 'Nursing Jobs' },
  { param: 'it', db: 'it', display: 'IT / Tech Jobs' },
  { param: 'teaching', db: 'teaching', display: 'Teaching Jobs' },
  { param: 'government', db: 'government', display: 'Government Jobs' },
  { param: 'gulf-return', db: 'gulf_return', display: 'Gulf Return Jobs' },
  { param: 'banking', db: 'banking', display: 'Banking / Cooperative Jobs' },
  { param: 'construction', db: 'construction', display: 'Construction Jobs' },
  { param: 'retail', db: 'retail', display: 'Retail / Trade Jobs' },
] as const;

// IT park badge label + brand color (by slug).
export const PARK_BADGE: Record<string, { label: string; color: string }> = {
  technopark: { label: 'Technopark', color: '#534AB7' },
  infopark: { label: 'Infopark', color: '#007D77' },
  cyberpark: { label: 'Cyberpark', color: '#F5A800' },
};

// PSC notification status -> label + colors.
export const PSC_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#1d7a3a', bg: '#e6f5ea' },
  exam_scheduled: { label: 'Exam scheduled', color: '#9a6b00', bg: '#fdf0d5' },
  rank_list: { label: 'Rank list', color: '#2a4d9b', bg: '#e8eefc' },
  closed: { label: 'Closed', color: '#6b6b66', bg: '#f1f1ec' },
};

// PSC tracker Kanban columns (status -> column).
export const PSC_KANBAN = [
  { key: 'active', label: 'Active' },
  { key: 'exam_scheduled', label: 'Exam Scheduled' },
  { key: 'rank_list', label: 'Rank List' },
  { key: 'advice', label: 'Advice' },
  { key: 'closed', label: 'Completed' },
] as const;

// Hero filter chips. `kind` decides how the chip maps to /jobs query params.
export const HERO_CHIPS = [
  { key: 'nursing', label: 'Nursing', kind: 'category' as const, value: 'nursing' },
  { key: 'it', label: 'IT', kind: 'category' as const, value: 'it' },
  { key: 'teaching', label: 'Teaching', kind: 'category' as const, value: 'teaching' },
  { key: 'walk_in', label: 'Walk-in', kind: 'flag' as const, value: 'is_walk_in' },
  { key: 'gulf_return', label: 'Gulf Return', kind: 'category' as const, value: 'gulf_return' },
  { key: 'psc', label: 'PSC', kind: 'link' as const, value: '/psc' },
] as const;
