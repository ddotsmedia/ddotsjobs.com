-- 0014_employer — additive. Employer registration fields.
-- employer_type_code holds the spec's 13 types (the employer_type enum has 5).

ALTER TABLE employers ADD COLUMN IF NOT EXISTS slug VARCHAR(120);
ALTER TABLE employers ADD COLUMN IF NOT EXISTS employer_type_code VARCHAR(30);
ALTER TABLE employers ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE employers ADD COLUMN IF NOT EXISTS employee_count_range VARCHAR(20);
ALTER TABLE employers ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier NOT NULL DEFAULT 'free';
ALTER TABLE employers ADD COLUMN IF NOT EXISTS jobs_posted_this_period INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS jobs_limit_this_period INTEGER NOT NULL DEFAULT 3;

CREATE UNIQUE INDEX IF NOT EXISTS employers_slug_uq
  ON employers (slug) WHERE slug IS NOT NULL AND deleted_at IS NULL;
