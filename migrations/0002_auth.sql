-- 0002_auth — additive. Adds explicit phone-verification timestamp for OTP auth.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
