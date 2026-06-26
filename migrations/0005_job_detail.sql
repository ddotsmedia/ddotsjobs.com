-- 0005_job_detail — additive. Detail-page fields + saved jobs.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements_en TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements_ml TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS benefits_en TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS benefits_ml TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employer_question_en TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employer_question_ml TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS valid_through TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS required_certifications JSONB NOT NULL DEFAULT '[]'::jsonb;

-- saved_jobs (soft-delete toggle; never hard delete from user tables)
CREATE TABLE IF NOT EXISTS saved_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS saved_jobs_user_job_uq ON saved_jobs (user_id, job_id);
CREATE INDEX IF NOT EXISTS saved_jobs_user_idx ON saved_jobs (user_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS set_updated_at_saved_jobs ON saved_jobs;
CREATE TRIGGER set_updated_at_saved_jobs BEFORE UPDATE ON saved_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
