-- 0023_employer_analytics — additive. Job views, boost timestamp, company profile.
CREATE TABLE IF NOT EXISTS job_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_views_job ON job_views (job_id, viewed_at DESC);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_boosted_at TIMESTAMPTZ;

ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS year_established INTEGER;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS benefits_offered TEXT[];
ALTER TABLE employers ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}';
