// NORKA scheme fallback + rule-based eligibility (no AI). Money in paise.

export interface NorkaScheme {
  slug: string;
  name: string;
  benefitType: string;
  maxBenefitPaise: number | null;
  descriptionEn: string;
  descriptionMl: string;
  documents: string[];
  applyUrl: string;
}

export const NORKA_FALLBACK: NorkaScheme[] = [
  {
    slug: 'ndprem',
    name: 'NDPREM Business Loan',
    benefitType: 'business_loan',
    maxBenefitPaise: 300_000_000, // ₹30,00,000
    descriptionEn: 'Subsidised business loan for returnees starting an enterprise in Kerala.',
    descriptionMl: 'കേരളത്തിൽ സംരംഭം തുടങ്ങുന്ന തിരിച്ചെത്തിയവർക്കുള്ള സബ്സിഡി വായ്പ.',
    documents: ['NORKA ID card', 'Passport copy', 'Project report'],
    applyUrl: 'https://norkaroots.org/ndprem',
  },
  {
    slug: 'santhwana',
    name: 'Santhwana Benefit',
    benefitType: 'welfare',
    maxBenefitPaise: 5_000_000, // ₹50,000
    descriptionEn: 'Financial aid for returnees facing death, accident or serious illness.',
    descriptionMl: 'മരണം, അപകടം അല്ലെങ്കിൽ ഗുരുതര രോഗം നേരിടുന്നവർക്കുള്ള ധനസഹായം.',
    documents: ['NORKA ID card', 'Medical certificate', 'Passport copy'],
    applyUrl: 'https://norkaroots.org/santhwana',
  },
  {
    slug: 'pravasi-dividend',
    name: 'Pravasi Dividend Pension',
    benefitType: 'insurance',
    maxBenefitPaise: null,
    descriptionEn: 'Insurance and pension scheme for registered returnees.',
    descriptionMl: 'രജിസ്റ്റർ ചെയ്ത പ്രവാസികൾക്കുള്ള ഇൻഷുറൻസ്/പെൻഷൻ പദ്ധതി.',
    documents: ['NORKA ID card', 'Age proof', 'Passport copy'],
    applyUrl: 'https://norkaroots.org/pravasi-dividend',
  },
  {
    slug: 'norka-roots',
    name: 'NORKA Roots Placement',
    benefitType: 'placement',
    maxBenefitPaise: null,
    descriptionEn: 'Job placement and recruitment support for returnees across Kerala.',
    descriptionMl: 'കേരളത്തിലുടനീളം തിരിച്ചെത്തിയവർക്കുള്ള തൊഴിൽ പ്ലേസ്മെന്റ് സഹായം.',
    documents: ['NORKA ID card', 'Resume', 'Passport copy'],
    applyUrl: 'https://norkaroots.org',
  },
];

/** Rule-based eligibility — which scheme slugs to surface for a profile. */
export function norkaEligibleSlugs(input: {
  totalYearsAbroad: number;
  financialUrgency: string;
}): string[] {
  const slugs = new Set<string>(['norka-roots']); // always
  if (input.totalYearsAbroad >= 2) slugs.add('santhwana');
  if (input.financialUrgency === 'immediate') slugs.add('ndprem');
  return [...slugs];
}
