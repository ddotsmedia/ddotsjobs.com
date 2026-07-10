-- 0034_referrals — additive. Referral links + a credit ledger + redemptions.
-- Balance is derived as SUM(referral_credits.amount) per user (ledger model).
CREATE TABLE IF NOT EXISTS referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE, -- null = generic link
  click_count INTEGER NOT NULL DEFAULT 0,
  apply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_links_code_uq ON referral_links (referral_code);
CREATE UNIQUE INDEX IF NOT EXISTS referral_links_user_job_uq ON referral_links (user_id, job_id);
CREATE INDEX IF NOT EXISTS referral_links_user_idx ON referral_links (user_id);
CREATE INDEX IF NOT EXISTS referral_links_job_idx ON referral_links (job_id, created_at);

-- Signed ledger: earnings positive, redemptions negative. Balance = SUM(amount).
CREATE TABLE IF NOT EXISTS referral_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL, -- apply | hire | redeem | adjust
  amount INTEGER NOT NULL,
  related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_credits_user_idx ON referral_credits (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redemption_type VARCHAR(30) NOT NULL, -- premium_month | employer_credits
  credits_used INTEGER NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'redeemed', -- pending | approved | redeemed
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_redemptions_user_idx ON referral_redemptions (user_id, created_at DESC);

-- Seeker premium (activated via credit redemption). null premium_until = free.
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_source VARCHAR(15); -- card | credits | admin
