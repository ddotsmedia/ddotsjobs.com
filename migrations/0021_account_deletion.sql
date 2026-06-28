-- 0021_account_deletion — additive. GDPR-style deletion request flag.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
