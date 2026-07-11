-- 0041_ats — additive. Applicant-tracking pipeline on top of the existing
-- application status fields. `stage` is the customizable per-job pipeline
-- position; notes_by_employer is an internal note thread.
CREATE TABLE IF NOT EXISTS hiring_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stages JSONB NOT NULL DEFAULT '["applied","screening","interview","offer","hired","rejected"]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hiring_pipelines_job_uq ON hiring_pipelines (job_id);
CREATE INDEX IF NOT EXISTS hiring_pipelines_employer_idx ON hiring_pipelines (employer_id, job_id);

ALTER TABLE applications ADD COLUMN IF NOT EXISTS stage VARCHAR(30) NOT NULL DEFAULT 'applied';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS staged_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes_by_employer JSONB NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS applications_stage_idx ON applications (job_id, stage);
