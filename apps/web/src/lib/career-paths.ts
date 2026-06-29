// Static career-progression data for Kerala sectors. Drives /career-paths pages.
export interface CareerStep {
  title: string;
  exp: string;
  salary: string;
  certs?: string;
}
export interface CareerPath {
  slug: string;
  label: string;
  labelMl: string;
  sector: string;
  emoji: string;
  intro: string;
  jobsQuery: string; // /jobs?... link for "view jobs"
  steps: CareerStep[];
  specializations?: { label: string; benefit: string }[];
  gulf?: { note: string; salary: string };
}

export const CAREER_PATHS: CareerPath[] = [
  {
    slug: 'staff-nurse',
    label: 'Staff Nurse',
    labelMl: 'സ്റ്റാഫ് നഴ്സ്',
    sector: 'Nursing & Healthcare',
    emoji: '🩺',
    intro:
      'Nursing is Kerala’s largest verified job category. With KNMC registration you can grow from a fresher GNM/BSc nurse to a Nursing Superintendent, and Gulf hospitals actively recruit experienced Kerala nurses.',
    jobsQuery: '/jobs?category=nursing',
    steps: [
      { title: 'GNM / BSc Nurse (Fresher)', exp: '0–1 yr', salary: '₹18,000–25,000/mo', certs: 'KNMC registration' },
      { title: 'Staff Nurse', exp: '1–3 yrs', salary: '₹25,000–45,000/mo', certs: 'KNMC + BLS/ACLS' },
      { title: 'Senior Nurse', exp: '3–7 yrs', salary: '₹45,000–80,000/mo' },
      { title: 'Ward Sister / Team Leader', exp: '7+ yrs', salary: '₹70,000–1,20,000/mo' },
      { title: 'Nursing Superintendent', exp: '15+ yrs', salary: '₹1,20,000–2,00,000/mo' },
    ],
    specializations: [
      { label: 'ICU / Critical Care', benefit: '+₹8,000–15,000/mo' },
      { label: 'OT / Anaesthesia', benefit: '+₹6,000–12,000/mo' },
      { label: 'NICU', benefit: '+₹6,000–12,000/mo' },
      { label: 'Dialysis', benefit: '+₹5,000–10,000/mo' },
      { label: 'Oncology', benefit: '+₹7,000–13,000/mo' },
    ],
    gulf: { note: 'Gulf hospitals recruit from Senior Nurse level (Prometric/DHA/HAAD).', salary: '~₹1,20,000/mo average' },
  },
  {
    slug: 'software-engineer',
    label: 'Software Engineer',
    labelMl: 'സോഫ്റ്റ്‌വെയർ എഞ്ചിനീയർ',
    sector: 'IT & Software',
    emoji: '💻',
    intro:
      'Kerala’s IT parks (Technopark, Infopark, Cyberpark) host product and services companies. Engineers grow from junior developer to engineering manager, with React/Node/Python and cloud skills driving salary jumps.',
    jobsQuery: '/jobs?category=it',
    steps: [
      { title: 'Junior Developer (Fresher)', exp: '0–1 yr', salary: '₹20,000–35,000/mo' },
      { title: 'Software Developer', exp: '1–3 yrs', salary: '₹35,000–70,000/mo' },
      { title: 'Senior Developer', exp: '3–6 yrs', salary: '₹70,000–1,30,000/mo' },
      { title: 'Tech Lead', exp: '6–10 yrs', salary: '₹1,30,000–2,20,000/mo' },
      { title: 'Engineering Manager', exp: '10+ yrs', salary: '₹2,00,000–3,50,000/mo' },
    ],
    specializations: [
      { label: 'React / Frontend', benefit: 'High demand in product firms' },
      { label: 'Node / Backend', benefit: 'API + systems roles' },
      { label: 'Python / Data / AI', benefit: 'Premium pay' },
      { label: 'DevOps / Cloud', benefit: '+15–25% salary' },
    ],
  },
  {
    slug: 'teacher',
    label: 'Teacher',
    labelMl: 'അധ്യാപകൻ',
    sector: 'Education',
    emoji: '📚',
    intro:
      'From primary teaching to principal, Kerala’s schools and colleges offer a clear ladder. K-TET (Kerala Teacher Eligibility Test) is required for most government and aided school roles.',
    jobsQuery: '/jobs?category=teaching',
    steps: [
      { title: 'Primary Teacher (Fresher)', exp: '0–2 yrs', salary: '₹18,000–28,000/mo', certs: 'K-TET + D.Ed/B.Ed' },
      { title: 'Secondary Teacher (HSA)', exp: '2–6 yrs', salary: '₹28,000–45,000/mo', certs: 'K-TET + B.Ed' },
      { title: 'Higher Secondary Teacher (PGT)', exp: '6–12 yrs', salary: '₹45,000–70,000/mo', certs: 'PG + B.Ed / NET' },
      { title: 'Head of Department', exp: '12–18 yrs', salary: '₹60,000–90,000/mo' },
      { title: 'Principal', exp: '18+ yrs', salary: '₹80,000–1,50,000/mo' },
    ],
  },
  {
    slug: 'doctor',
    label: 'Doctor',
    labelMl: 'ഡോക്ടർ',
    sector: 'Healthcare',
    emoji: '⚕️',
    intro: 'Medical careers in Kerala run from house surgeon to consultant and HOD, with specialisation (MD/MS/DNB) driving the biggest income growth.',
    jobsQuery: '/jobs?category=healthcare',
    steps: [
      { title: 'House Surgeon / Intern', exp: '0–1 yr', salary: '₹25,000–40,000/mo', certs: 'MBBS + TCMC' },
      { title: 'Medical Officer', exp: '1–4 yrs', salary: '₹50,000–90,000/mo' },
      { title: 'Specialist (post MD/MS)', exp: '4–10 yrs', salary: '₹1,00,000–2,50,000/mo', certs: 'MD / MS / DNB' },
      { title: 'Consultant', exp: '10+ yrs', salary: '₹2,50,000–6,00,000/mo' },
      { title: 'HOD / Medical Director', exp: '18+ yrs', salary: '₹5,00,000+/mo' },
    ],
  },
  {
    slug: 'pharmacist',
    label: 'Pharmacist',
    labelMl: 'ഫാർമസിസ്റ്റ്',
    sector: 'Healthcare',
    emoji: '💊',
    intro: 'Pharmacists work in hospitals, retail chains, and pharma companies. Kerala Pharmacy Council registration is mandatory to practise.',
    jobsQuery: '/jobs?category=pharmacy',
    steps: [
      { title: 'Pharmacist (Fresher)', exp: '0–2 yrs', salary: '₹15,000–22,000/mo', certs: 'D.Pharm + Pharmacy Council reg.' },
      { title: 'Senior Pharmacist', exp: '2–5 yrs', salary: '₹22,000–35,000/mo', certs: 'B.Pharm' },
      { title: 'Pharmacy In-charge', exp: '5–10 yrs', salary: '₹35,000–55,000/mo' },
      { title: 'Chief Pharmacist / Manager', exp: '10+ yrs', salary: '₹55,000–90,000/mo' },
    ],
  },
  {
    slug: 'driver',
    label: 'Driver',
    labelMl: 'ഡ്രൈവർ',
    sector: 'Transport & Logistics',
    emoji: '🚗',
    intro: 'Driving roles span personal, commercial, and heavy vehicles. A clean licence, badge, and HMV endorsement open higher-paying logistics and Gulf opportunities.',
    jobsQuery: '/driver-jobs',
    steps: [
      { title: 'Light Vehicle Driver', exp: '0–2 yrs', salary: '₹15,000–22,000/mo', certs: 'LMV licence + badge' },
      { title: 'Commercial Driver', exp: '2–5 yrs', salary: '₹20,000–32,000/mo', certs: 'HMV endorsement' },
      { title: 'Heavy Vehicle / Bus Driver', exp: '5–10 yrs', salary: '₹28,000–45,000/mo' },
      { title: 'Fleet / Transport Supervisor', exp: '10+ yrs', salary: '₹40,000–65,000/mo' },
    ],
    gulf: { note: 'Gulf logistics firms hire experienced HMV drivers.', salary: '~₹65,000–90,000/mo' },
  },
  {
    slug: 'accountant',
    label: 'Accountant',
    labelMl: 'അക്കൗണ്ടന്റ്',
    sector: 'Finance & Accounts',
    emoji: '🧮',
    intro: 'Accounting careers grow from junior accountant to finance manager. Tally, GST, and audit experience accelerate progression; CA/CMA unlocks the top roles.',
    jobsQuery: '/jobs?category=accounting',
    steps: [
      { title: 'Junior Accountant (Fresher)', exp: '0–2 yrs', salary: '₹15,000–22,000/mo', certs: 'B.Com + Tally/GST' },
      { title: 'Accountant', exp: '2–5 yrs', salary: '₹22,000–38,000/mo' },
      { title: 'Senior Accountant', exp: '5–9 yrs', salary: '₹38,000–60,000/mo' },
      { title: 'Accounts / Finance Manager', exp: '9+ yrs', salary: '₹60,000–1,20,000/mo', certs: 'CA / CMA preferred' },
    ],
  },
  {
    slug: 'cooperative-clerk',
    label: 'Cooperative Clerk',
    labelMl: 'സഹകരണ ക്ലർക്ക്',
    sector: 'Cooperative Sector',
    emoji: '🤝',
    intro: 'Kerala’s cooperative banks and societies are major local employers. Roles progress from clerk/cashier to branch manager, often via the Cooperative Service Examination Board.',
    jobsQuery: '/cooperative-jobs',
    steps: [
      { title: 'Clerk / Cashier (Fresher)', exp: '0–3 yrs', salary: '₹18,000–28,000/mo', certs: 'HDC/JDC preferred' },
      { title: 'Senior Clerk / Accountant', exp: '3–8 yrs', salary: '₹28,000–42,000/mo' },
      { title: 'Branch Supervisor', exp: '8–15 yrs', salary: '₹42,000–60,000/mo' },
      { title: 'Branch / Society Manager', exp: '15+ yrs', salary: '₹60,000–90,000/mo' },
    ],
  },
];

export function getCareerPath(slug: string): CareerPath | undefined {
  return CAREER_PATHS.find((p) => p.slug === slug);
}
