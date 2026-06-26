-- 0004_job_filters — additive. Listing/detail filter flags on jobs.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS values_gulf_experience BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_disclosed BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS jobs_values_gulf_idx ON jobs (values_gulf_experience);
