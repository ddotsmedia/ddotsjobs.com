-- 0007_gulf — additive. Gulf-return (pravasi) profile fields, title translation
-- cache, NORKA scheme metadata + seed.

-- pravasi_profiles
ALTER TABLE pravasi_profiles ADD COLUMN IF NOT EXISTS total_years_abroad INTEGER;
ALTER TABLE pravasi_profiles ADD COLUMN IF NOT EXISTS financial_urgency VARCHAR(30) NOT NULL DEFAULT 'moderate';
ALTER TABLE pravasi_profiles ADD COLUMN IF NOT EXISTS seeking_employment_in JSONB NOT NULL DEFAULT '[]'::jsonb;

-- pravasi_work_history
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS gulf_job_title VARCHAR(255);
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS industry VARCHAR(120);
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS years_in_role INTEGER;
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS key_skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS certifications JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS translated_kerala_titles JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS translation_confidence REAL;
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS translation_source VARCHAR(30);
ALTER TABLE pravasi_work_history ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS pravasi_work_history_user_idx ON pravasi_work_history (user_id);

-- gulf_title_translations
ALTER TABLE gulf_title_translations ADD COLUMN IF NOT EXISTS gulf_title VARCHAR(255);
ALTER TABLE gulf_title_translations ADD COLUMN IF NOT EXISTS gulf_title_normalized VARCHAR(255);
ALTER TABLE gulf_title_translations ADD COLUMN IF NOT EXISTS kerala_equivalents JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE gulf_title_translations ADD COLUMN IF NOT EXISTS industry VARCHAR(120);
ALTER TABLE gulf_title_translations ADD COLUMN IF NOT EXISTS confidence_score REAL;
ALTER TABLE gulf_title_translations ADD COLUMN IF NOT EXISTS translation_source VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS gulf_title_normalized_uq
  ON gulf_title_translations (gulf_title_normalized) WHERE gulf_title_normalized IS NOT NULL;

-- norka_schemes metadata
ALTER TABLE norka_schemes ADD COLUMN IF NOT EXISTS benefit_type VARCHAR(60);
ALTER TABLE norka_schemes ADD COLUMN IF NOT EXISTS max_benefit_paise BIGINT;
ALTER TABLE norka_schemes ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;

-- seed 4 core schemes (idempotent)
INSERT INTO norka_schemes (slug, title_en, title_ml, summary_en, summary_ml, benefit_type, max_benefit_paise, apply_url, documents, is_active)
VALUES
 ('ndprem','NDPREM Business Loan','എൻ.ഡി.പ്രേം വായ്പ',
  'Subsidised business loan for returnees starting an enterprise in Kerala.',
  'കേരളത്തിൽ സംരംഭം തുടങ്ങുന്ന തിരിച്ചെത്തിയവർക്കുള്ള സബ്സിഡി വായ്പ.',
  'business_loan', 300000000, 'https://norkaroots.org/ndprem',
  '["NORKA ID card","Passport copy","Project report"]'::jsonb, true),
 ('santhwana','Santhwana Benefit','സാന്ത്വന ധനസഹായം',
  'Financial aid for returnees facing death, accident or serious illness.',
  'മരണം, അപകടം അല്ലെങ്കിൽ ഗുരുതര രോഗം നേരിടുന്നവർക്കുള്ള ധനസഹായം.',
  'welfare', 5000000, 'https://norkaroots.org/santhwana',
  '["NORKA ID card","Medical certificate","Passport copy"]'::jsonb, true),
 ('pravasi-dividend','Pravasi Dividend Pension','പ്രവാസി ഡിവിഡന്റ് പെൻഷൻ',
  'Insurance and pension scheme for registered returnees.',
  'രജിസ്റ്റർ ചെയ്ത പ്രവാസികൾക്കുള്ള ഇൻഷുറൻസ്/പെൻഷൻ പദ്ധതി.',
  'insurance', NULL, 'https://norkaroots.org/pravasi-dividend',
  '["NORKA ID card","Age proof","Passport copy"]'::jsonb, true),
 ('norka-roots','NORKA Roots Placement','നോർക്ക റൂട്ട്സ് പ്ലേസ്മെന്റ്',
  'Job placement and recruitment support for returnees across Kerala.',
  'കേരളത്തിലുടനീളം തിരിച്ചെത്തിയവർക്കുള്ള തൊഴിൽ പ്ലേസ്മെന്റ് സഹായം.',
  'placement', NULL, 'https://norkaroots.org',
  '["NORKA ID card","Resume","Passport copy"]'::jsonb, true)
ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;
