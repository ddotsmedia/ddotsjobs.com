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

// Hero filter chips. `kind` decides how the chip maps to /jobs query params.
export const HERO_CHIPS = [
  { key: 'nursing', label: 'Nursing', kind: 'category' as const, value: 'nursing' },
  { key: 'it', label: 'IT', kind: 'category' as const, value: 'it' },
  { key: 'teaching', label: 'Teaching', kind: 'category' as const, value: 'teaching' },
  { key: 'walk_in', label: 'Walk-in', kind: 'flag' as const, value: 'is_walk_in' },
  { key: 'gulf_return', label: 'Gulf Return', kind: 'category' as const, value: 'gulf_return' },
  { key: 'psc', label: 'PSC', kind: 'link' as const, value: '/psc' },
] as const;
