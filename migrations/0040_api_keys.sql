-- 0040_api_keys — additive. Programmatic job-posting API credentials.
-- key_hash is a SHA-256 of the full key (deterministic → indexable O(1)
-- lookup; the raw key is high-entropy so there is no rainbow-table risk).
-- The plaintext key is shown once at creation and never stored.
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL,
  key_prefix VARCHAR(24) NOT NULL, -- shown masked in the UI, e.g. ddj_live_ab12cd
  label VARCHAR(100),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_uq ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_employer_idx ON api_keys (employer_id);
