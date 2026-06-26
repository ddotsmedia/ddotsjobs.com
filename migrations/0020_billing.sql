-- 0020_billing — additive. Employer subscription tiers + per-plan entitlements
-- and GST fields. Existing subscriptions/payments are user-scoped; we add an
-- employer scope alongside (user_id stays populated to satisfy NOT NULL).

ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'employer_starter';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'employer_growth';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'hospital_pro';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'agency';

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES employers(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS jobs_per_period INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS talent_pool_access BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS knmc_filter_access BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS whatsapp_push_per_month INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS walk_in_notices_per_month INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS subscriptions_employer_idx ON subscriptions(employer_id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES employers(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gst_amount_paise BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gst_rate_pct SMALLINT NOT NULL DEFAULT 18;
CREATE INDEX IF NOT EXISTS payments_employer_idx ON payments(employer_id);
