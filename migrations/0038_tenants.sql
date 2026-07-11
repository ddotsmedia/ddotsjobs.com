-- 0038_tenants — additive. White-label tenants: per-domain branding + feature
-- flags. NOTE: this ships branding + feature-flag infrastructure only. Full
-- data isolation (tenant_id on every table + auto-filtered queries) is a large,
-- separate, higher-risk migration and is intentionally NOT included here.
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) NOT NULL,
  domain VARCHAR(255),
  name VARCHAR(120) NOT NULL,
  logo TEXT,
  colors JSONB NOT NULL DEFAULT '{}', -- { primary, secondary, accent }
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_uq ON tenants (slug);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_domain_uq ON tenants (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS tenants_active_idx ON tenants (is_active);

CREATE TABLE IF NOT EXISTS tenant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_features_uq ON tenant_features (tenant_id, feature);

-- Default tenant = the current ddotsjobs site, all features on.
INSERT INTO tenants (slug, domain, name, colors, is_active)
VALUES ('ddotsjobs', 'ddotsjobs.com', 'ddotsjobs', '{"primary":"#F5C842","secondary":"#3A9EA5","accent":"#E8623A"}', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_features (tenant_id, feature, is_enabled)
SELECT t.id, f.feature, true
FROM tenants t
CROSS JOIN (VALUES ('job_posting'), ('chat'), ('video_interviews'), ('referrals'), ('endorsements'), ('reviews'), ('screening')) AS f(feature)
WHERE t.slug = 'ddotsjobs'
ON CONFLICT (tenant_id, feature) DO NOTHING;
