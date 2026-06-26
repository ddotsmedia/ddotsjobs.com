-- 0009_seeker — additive. Seeker profile setup fields.

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_district district;
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_profession VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_professional BOOLEAN NOT NULL DEFAULT false;

-- seeker_profiles
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS completion_pct INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS total_experience_months INTEGER;
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS current_employer VARCHAR(255);
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS preferred_categories JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS preferred_job_types JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'selective';
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS contact_via_platform_only BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS show_current_employer BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS is_open_to_work BOOLEAN NOT NULL DEFAULT true;
