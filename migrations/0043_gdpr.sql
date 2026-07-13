-- 0043_gdpr — additive. GDPR/CCPA data-export + right-to-be-forgotten.
-- Audit trail reuses the existing append-only audit_log table (ip_address + user_agent
-- already present); this migration only adds the request-tracking tables.

CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | processing | ready | failed | expired
  storage_key TEXT,
  size_bytes INTEGER,
  error TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS data_export_user_idx ON data_export_requests (user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS data_export_status_idx ON data_export_requests (status);

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | completed | denied
  reason TEXT,
  mode VARCHAR(10) NOT NULL DEFAULT 'soft', -- soft | hard
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS data_deletion_user_status_idx ON data_deletion_requests (user_id, status);
CREATE INDEX IF NOT EXISTS data_deletion_status_idx ON data_deletion_requests (status, requested_at DESC);
