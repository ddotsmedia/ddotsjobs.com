-- 0003_jobs_slug — additive. URL slug for job detail pages (/jobs/[slug]).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_slug_uq
  ON jobs (slug) WHERE slug IS NOT NULL AND deleted_at IS NULL;
