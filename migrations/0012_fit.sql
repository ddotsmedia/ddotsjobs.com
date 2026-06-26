-- 0012_fit — additive. Fit-score sub-scores + job language requirement.

ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS overall_score INTEGER;
ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS qualification_score INTEGER;
ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS experience_score INTEGER;
ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS location_score INTEGER;
ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS salary_score INTEGER;
ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS language_score INTEGER;
ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS cert_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS recommendation VARCHAR(20);
ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS explanation_en TEXT;
ALTER TABLE fit_scores ADD COLUMN IF NOT EXISTS explanation_ml TEXT;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS language_requirement VARCHAR(10) NOT NULL DEFAULT 'both';
