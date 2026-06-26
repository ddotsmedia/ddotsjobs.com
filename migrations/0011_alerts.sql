-- 0011_alerts — additive. Alert subscription filters + dispatch tracking.

-- alert_subscriptions
ALTER TABLE alert_subscriptions ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'ml';
ALTER TABLE alert_subscriptions ADD COLUMN IF NOT EXISTS frequency_code VARCHAR(20) NOT NULL DEFAULT 'immediate';
ALTER TABLE alert_subscriptions ADD COLUMN IF NOT EXISTS total_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alert_subscriptions ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS alert_subs_user_channel_uq
  ON alert_subscriptions (seeker_user_id, channel) WHERE deleted_at IS NULL;

-- alert_filters (text type/value for fast equality joins)
ALTER TABLE alert_filters ADD COLUMN IF NOT EXISTS filter_type VARCHAR(40);
ALTER TABLE alert_filters ADD COLUMN IF NOT EXISTS filter_value VARCHAR(255);
CREATE INDEX IF NOT EXISTS alert_filters_type_value_idx
  ON alert_filters (subscription_id, filter_type, filter_value);

-- alert_dispatch_log
ALTER TABLE alert_dispatch_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE alert_dispatch_log ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;
ALTER TABLE alert_dispatch_log ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMPTZ;
ALTER TABLE alert_dispatch_log ADD COLUMN IF NOT EXISTS failure_reason TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS alert_dispatch_job_user_uq
  ON alert_dispatch_log (job_id, user_id) WHERE user_id IS NOT NULL;

-- jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS alert_recipients_count INTEGER NOT NULL DEFAULT 0;
