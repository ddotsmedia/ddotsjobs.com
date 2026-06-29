-- 0024_admin_features — additive. Site settings + employer suspension.
-- (audit_log already has ip_address + diff; users already has ban_reason + banned_at.)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (key, value) VALUES
  ('job_moderation_required', 'true'),
  ('ai_features_enabled', 'true'),
  ('new_registrations_open', 'true'),
  ('whatsapp_alerts_active', 'true'),
  ('payment_enabled', 'false'),
  ('maintenance_mode', 'false'),
  ('auto_approve_verified', 'false'),
  ('default_job_expiry_days', '30'),
  ('max_free_jobs', '3'),
  ('risk_score_threshold', '60'),
  ('site_tagline', 'Kerala''s job portal'),
  ('contact_whatsapp', '+971509379212'),
  ('contact_email', 'info@ddotsmedia.com')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE employers ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS suspension_ends_at TIMESTAMPTZ;
