-- 0031_skill_endorsements — additive. Peer skill endorsements + denormalized
-- per-skill counts. One endorsement per (endorser, endorsee, skill), toggleable.
CREATE TABLE IF NOT EXISTS skill_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endorsee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS skill_endorsements_uq
  ON skill_endorsements (endorser_id, endorsee_id, skill_name);
CREATE INDEX IF NOT EXISTS skill_endorsements_endorsee_idx
  ON skill_endorsements (endorsee_id, skill_name);

-- Denormalized count per (user, skill) for fast profile reads + leaderboard.
CREATE TABLE IF NOT EXISTS user_skill_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name VARCHAR(80) NOT NULL,
  endorsement_count INTEGER NOT NULL DEFAULT 0,
  last_endorsed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS user_skill_summary_uq
  ON user_skill_summary (user_id, skill_name);
CREATE INDEX IF NOT EXISTS user_skill_summary_count_idx
  ON user_skill_summary (user_id, endorsement_count DESC);
CREATE INDEX IF NOT EXISTS user_skill_summary_skill_idx
  ON user_skill_summary (skill_name, endorsement_count DESC);
