-- 0015_jobs_post — additive. Job-post builder fields.

ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'closed';

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS min_experience_months INTEGER NOT NULL DEFAULT 0;

-- backfill months from the legacy years column where months unset
UPDATE jobs SET min_experience_months = coalesce(min_experience_years, 0) * 12
  WHERE min_experience_months = 0 AND coalesce(min_experience_years, 0) > 0;
