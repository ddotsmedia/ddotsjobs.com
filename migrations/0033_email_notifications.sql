-- 0033_email_notifications — additive. Per-user email preferences + a send log.
-- Prefs default ON per type, but a global site_settings kill-switch
-- ('email_notifications_active', default off) gates ALL sends, so enabling
-- this feature is an explicit admin action.
CREATE TABLE IF NOT EXISTS email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notify_on_messages BOOLEAN NOT NULL DEFAULT true,
  notify_on_job_alerts BOOLEAN NOT NULL DEFAULT true,
  notify_on_expiry BOOLEAN NOT NULL DEFAULT true,
  notify_on_applications BOOLEAN NOT NULL DEFAULT true,
  notify_on_endorsements BOOLEAN NOT NULL DEFAULT true,
  digest_frequency VARCHAR(10) NOT NULL DEFAULT 'daily', -- daily | weekly | never
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_preferences_user_uq ON email_preferences (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS email_preferences_token_uq ON email_preferences (unsubscribe_token);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  status VARCHAR(10) NOT NULL, -- sent | failed | skipped
  bounce_reason TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_logs_user_idx ON email_logs (user_id);
CREATE INDEX IF NOT EXISTS email_logs_event_idx ON email_logs (event_type, sent_at DESC);
