-- 0013_applications — additive. Application flow fields.
-- status_code is the source of truth (the application_status enum lacks
-- under_review / interview_scheduled / interviewed / offer_made).

ALTER TABLE applications ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES employers(id) ON DELETE CASCADE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status_code VARCHAR(30) NOT NULL DEFAULT 'applied';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS fit_score_at_apply INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS fit_breakdown_at_apply JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS question_response TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS has_voice_note BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS voice_note_r2_key TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS voice_note_duration_s INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS applied_via VARCHAR(20) NOT NULL DEFAULT 'web';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_scheduled_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS applications_employer_idx ON applications (employer_id);
CREATE INDEX IF NOT EXISTS applications_status_code_idx ON applications (status_code);
