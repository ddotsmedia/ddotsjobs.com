// Pure fit-score computation. No external calls, no AI. Deterministic.

export interface FitScoreInput {
  seeker: {
    totalExperienceMonths: number;
    primaryDistrict: string | null;
    willingDistricts: string[];
    salaryMinPaise: number | null;
    salaryMaxPaise: number | null;
    preferredCategories: string[];
    preferredLanguage: string;
    professionalRegistrations: Array<{ type: string; verificationStatus: string }>;
  };
  job: {
    district: string;
    category: string;
    minExperienceMonths: number;
    maxExperienceMonths: number | null;
    salaryMinPaise: number | null;
    salaryMaxPaise: number | null;
    salaryDisclosed: boolean;
    languageRequirement: string;
    requiredCertifications: string[];
  };
}

export type Recommendation = 'strong_match' | 'apply' | 'consider' | 'mismatch';

export interface FitScoreResult {
  overall: number;
  qualification: number;
  experience: number;
  location: number;
  salary: number;
  language: number;
  certBonus: number;
  recommendation: Recommendation;
}

function qualificationScore(i: FitScoreInput): number {
  if (i.seeker.preferredCategories.includes(i.job.category)) return 100;
  if (i.seeker.preferredCategories.length === 0) return 75;
  return 40;
}

function experienceScore(i: FitScoreInput): number {
  const have = i.seeker.totalExperienceMonths;
  const need = i.job.minExperienceMonths;
  if (need === 0) return 100;
  if (have >= need) return 100;
  if (have === 0 && need <= 6) return 60;
  if (have === 0 && need > 6) return 30;
  return Math.min(100, Math.round((have / need) * 100));
}

function locationScore(i: FitScoreInput): number {
  if (i.seeker.primaryDistrict === i.job.district) return 100;
  if (i.seeker.willingDistricts.includes(i.job.district)) return 80;
  if (i.seeker.willingDistricts.length === 0) return 60;
  return 20;
}

function salaryScore(i: FitScoreInput): number {
  if (!i.job.salaryDisclosed) return 60;
  if (i.job.salaryMinPaise == null) return 60;
  if (i.seeker.salaryMinPaise == null) return 70;

  const seekerMin = i.seeker.salaryMinPaise;
  const seekerMax = i.seeker.salaryMaxPaise ?? Number.MAX_SAFE_INTEGER;
  const jobMin = i.job.salaryMinPaise;
  const jobMax = i.job.salaryMaxPaise ?? Number.MAX_SAFE_INTEGER;

  const overlap = Math.min(seekerMax, jobMax) - Math.max(seekerMin, jobMin);
  if (overlap > 0) return 100;
  if (seekerMin <= jobMax) return 80;
  return 20;
}

function languageScore(i: FitScoreInput): number {
  if (i.job.languageRequirement === 'both') return 100;
  if (i.job.languageRequirement === i.seeker.preferredLanguage) return 100;
  return 70;
}

function certBonus(i: FitScoreInput): number {
  let bonus = 0;
  for (const cert of i.job.requiredCertifications) {
    const has = i.seeker.professionalRegistrations.some(
      (r) =>
        r.verificationStatus === 'verified' &&
        r.type.toLowerCase() === cert.toLowerCase(),
    );
    if (has) bonus += 5;
  }
  return Math.min(10, bonus);
}

function recommend(overall: number): Recommendation {
  if (overall >= 80) return 'strong_match';
  if (overall >= 65) return 'apply';
  if (overall >= 45) return 'consider';
  return 'mismatch';
}

export function computeFitScore(input: FitScoreInput): FitScoreResult {
  const qualification = qualificationScore(input);
  const experience = experienceScore(input);
  const location = locationScore(input);
  const salary = salaryScore(input);
  const language = languageScore(input);
  const bonus = certBonus(input);

  const weighted =
    qualification * 0.2 + experience * 0.25 + location * 0.25 + salary * 0.2 + language * 0.1;
  const overall = Math.min(100, Math.round(weighted) + bonus);

  return {
    overall,
    qualification,
    experience,
    location,
    salary,
    language,
    certBonus: bonus,
    recommendation: recommend(overall),
  };
}
