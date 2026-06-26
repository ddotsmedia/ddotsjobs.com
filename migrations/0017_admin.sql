-- 0017_admin — additive. Moderation + ban fields for the admin dashboard.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Job moderation.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS risk_score SMALLINT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderation_note TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderated_by_user_id UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- User bans.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
