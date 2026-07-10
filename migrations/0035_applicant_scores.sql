-- 0035_applicant_scores — additive. AI resume-screening results per application.
-- One score per application (rescore updates it). Complements the algorithmic
-- fit_score already on applications.
CREATE TABLE IF NOT EXISTS applicant_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_score INTEGER NOT NULL, -- 0-100
  match_reasons JSONB NOT NULL DEFAULT '{}',
  reasoning TEXT,
  model VARCHAR(20),
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS applicant_scores_application_uq ON applicant_scores (application_id);
CREATE INDEX IF NOT EXISTS applicant_scores_job_idx ON applicant_scores (job_id, ai_score DESC);
CREATE INDEX IF NOT EXISTS applicant_scores_user_idx ON applicant_scores (user_id);
