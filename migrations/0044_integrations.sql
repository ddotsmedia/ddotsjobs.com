-- 0044_integrations — additive. Employer integration marketplace (Slack, HubSpot,
-- LinkedIn, Zapier, Airtable). Tokens/credentials stored AES-256-GCM encrypted.

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  provider_name VARCHAR(20) NOT NULL, -- slack | hubspot | linkedin | zapier | airtable
  is_connected BOOLEAN NOT NULL DEFAULT false,
  access_token TEXT,   -- encrypted credential blob
  refresh_token TEXT,  -- encrypted, optional
  expires_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}', -- non-secret display hints (base id, masked url, ...)
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS integrations_employer_provider_uq ON integrations (employer_id, provider_name);
CREATE INDEX IF NOT EXISTS integrations_connected_idx ON integrations (employer_id, is_connected);

CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL, -- job_posted | application_received | offer_sent
  is_push_enabled BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_events_uq ON integration_events (integration_id, event_type);
CREATE INDEX IF NOT EXISTS integration_events_integration_idx ON integration_events (integration_id);
