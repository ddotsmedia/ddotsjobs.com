-- 0010_verification — additive. Professional-registration verification fields.
-- Spec keys on user_id + free-form type_code/status_code (the verification_status
-- enum lacks 'failed'/'manual_review', so status_code is the source of truth).

ALTER TABLE professional_registrations ALTER COLUMN seeker_profile_id DROP NOT NULL;
ALTER TABLE professional_registrations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE professional_registrations ADD COLUMN IF NOT EXISTS type_code VARCHAR(40);
ALTER TABLE professional_registrations ADD COLUMN IF NOT EXISTS status_code VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE professional_registrations ADD COLUMN IF NOT EXISTS verification_method VARCHAR(30);
ALTER TABLE professional_registrations ADD COLUMN IF NOT EXISTS ai_extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE professional_registrations ADD COLUMN IF NOT EXISTS ai_confidence_score REAL;
ALTER TABLE professional_registrations ADD COLUMN IF NOT EXISTS ai_extraction_model VARCHAR(60);
ALTER TABLE professional_registrations ADD COLUMN IF NOT EXISTS verifier_notes TEXT;

CREATE INDEX IF NOT EXISTS prof_reg_user_idx ON professional_registrations (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS prof_reg_user_type_uq
  ON professional_registrations (user_id, type_code) WHERE deleted_at IS NULL;
