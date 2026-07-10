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

// Experience-level filter buckets (min required experience, in months).
// Keys match the jobs.list `experience` enum.
export const EXPERIENCE_LEVELS_UI = [
  { value: 'entry', label: 'Entry · 0–2 yr' },
  { value: 'mid', label: 'Mid · 2–5 yr' },
  { value: 'senior', label: 'Senior · 5–10 yr' },
  { value: 'lead', label: 'Lead · 10 yr+' },
] as const;

// Job-post builder options.
export const JOB_CATEGORIES = [
  { slug: 'nursing', label: 'Nursing' },
  { slug: 'it', label: 'IT/Software' },
  { slug: 'teaching', label: 'Teaching' },
  { slug: 'government', label: 'Government' },
  { slug: 'engineering', label: 'Engineering' },
  { slug: 'accounting', label: 'Accounting' },
  { slug: 'construction', label: 'Construction' },
  { slug: 'hospitality', label: 'Hospitality' },
  { slug: 'retail', label: 'Retail' },
  { slug: 'banking', label: 'Banking/Finance' },
  { slug: 'healthcare', label: 'Healthcare' },
  { slug: 'other', label: 'Other' },
] as const;

export const JOB_POST_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'freelance', label: 'Freelance' },
] as const;

export const JOB_CERTS = ['KNMC', 'KTET', 'KMC', 'ITI', 'ASAP', 'Other'] as const;

export const JOB_EXPERIENCE = [
  { months: 0, label: 'No experience required' },
  { months: 6, label: '6 months+' },
  { months: 12, label: '1 year+' },
  { months: 24, label: '2 years+' },
  { months: 36, label: '3 years+' },
  { months: 60, label: '5 years+' },
  { months: 120, label: '10 years+' },
] as const;

// Employer registration options.
export const EMPLOYER_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'it_company', label: 'IT Company' },
  { value: 'school', label: 'School' },
  { value: 'college', label: 'College' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'government', label: 'Government' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'construction', label: 'Construction' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'ngo', label: 'NGO' },
  { value: 'other', label: 'Other' },
] as const;

export const EMPLOYEE_COUNTS = ['1-10', '11-50', '51-200', '200+'] as const;

export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Seeker profile setup options.
export const PROFESSIONS = [
  'Nursing', 'Teaching', 'IT/Software', 'Engineering', 'Accounting', 'Management',
  'Construction', 'Hospitality', 'Retail', 'Government', 'Other',
] as const;

export const SEEKER_CATEGORIES = [
  { slug: 'nursing', label: 'Nursing' },
  { slug: 'it', label: 'IT/Tech' },
  { slug: 'teaching', label: 'Teaching' },
  { slug: 'government', label: 'Government/PSC' },
  { slug: 'gulf_return', label: 'Gulf Return' },
  { slug: 'banking', label: 'Banking/Coop' },
  { slug: 'construction', label: 'Construction' },
  { slug: 'retail', label: 'Retail' },
  { slug: 'other', label: 'Other' },
] as const;

export const SEEKER_JOB_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'contract', label: 'Contract' },
] as const;

export const EXPERIENCE_OPTIONS = [
  { months: 0, label: 'Fresher' },
  { months: 6, label: '<1 year' },
  { months: 18, label: '1–2 years' },
  { months: 48, label: '3–5 years' },
  { months: 84, label: '5–10 years' },
  { months: 132, label: '10+ years' },
] as const;

export const VISIBILITY_OPTIONS = [
  {
    value: 'private',
    en: 'Nobody — I will apply directly',
    ml: 'ആരും കാണില്ല — ഞാൻ നേരിട്ട് apply ചെയ്യും',
  },
  {
    value: 'selective',
    en: 'Verified employers in my district only',
    ml: 'എന്റെ ജില്ലയിലെ verified employers മാത്രം',
  },
  {
    value: 'open',
    en: 'All verified employers in Kerala',
    ml: 'Kerala-ലെ എല്ലാ verified employers-ഉം',
  },
] as const;

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
