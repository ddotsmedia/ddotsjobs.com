-- 0046_push_notifications — additive. FCM mobile push: device tokens, delivered
-- notifications, per-user push preferences + quiet hours. Tokens stored AES-GCM
-- encrypted; token_hash (sha256 of plaintext) gives a stable uniqueness key.

CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(10) NOT NULL, -- ios | android | web
  token TEXT NOT NULL,           -- encrypted FCM registration token
  token_hash VARCHAR(64) NOT NULL, -- sha256(plaintext) for dedupe
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_user_hash_uq ON device_tokens (user_id, token_hash);
CREATE INDEX IF NOT EXISTS device_tokens_user_active_idx ON device_tokens (user_id, is_active);

CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_notifications_user_created_idx ON push_notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_messages BOOLEAN NOT NULL DEFAULT true,
  push_job_alerts BOOLEAN NOT NULL DEFAULT true,
  push_applications BOOLEAN NOT NULL DEFAULT true,
  push_endorsements BOOLEAN NOT NULL DEFAULT true,
  quiet_start_hour SMALLINT, -- 0-23 IST; null = quiet hours off
  quiet_end_hour SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS push_preferences_user_uq ON push_preferences (user_id);
