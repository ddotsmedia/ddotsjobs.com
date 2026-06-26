-- 0002_it_parks — additive. IT park hub tables + jobs.it_park_id + seed.

CREATE TABLE IF NOT EXISTS it_parks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              VARCHAR(50) UNIQUE NOT NULL,
  name              VARCHAR(100) NOT NULL,
  city              VARCHAR(50) NOT NULL,
  district          district NOT NULL,
  description       TEXT,
  total_companies   INT DEFAULT 0,
  total_employees   INT DEFAULT 0,
  established_year  SMALLINT,
  website_url       TEXT,
  seo_title         TEXT,
  seo_description   TEXT,
  active_jobs_count INT DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS it_park_tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES employers(id) ON DELETE CASCADE,
  park_id     UUID NOT NULL REFERENCES it_parks(id),
  campus      VARCHAR(50),
  is_sez      BOOLEAN DEFAULT FALSE,
  tech_stack  TEXT[] DEFAULT '{}',
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, park_id)
);
CREATE INDEX IF NOT EXISTS idx_it_park_tenants_park ON it_park_tenants (park_id);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS it_park_id UUID REFERENCES it_parks(id);
CREATE INDEX IF NOT EXISTS idx_jobs_itpark ON jobs (it_park_id)
  WHERE it_park_id IS NOT NULL AND status = 'active' AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS set_updated_at_it_parks ON it_parks;
CREATE TRIGGER set_updated_at_it_parks BEFORE UPDATE ON it_parks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO it_parks
  (slug, name, city, district, total_companies, total_employees, established_year,
   website_url, seo_title, seo_description)
VALUES
  ('technopark','Technopark','Thiruvananthapuram','thiruvananthapuram',582,75000,1990,
   'https://technopark.org',
   'Technopark Jobs Thiruvananthapuram — ddotsjobs.com',
   'Find IT jobs at Technopark Trivandrum. 582 companies, 75000+ professionals.'),
  ('infopark','Infopark','Ernakulam','ernakulam',450,72000,2004,
   'https://infopark.in',
   'Infopark Jobs Kochi — ddotsjobs.com',
   'Find IT jobs at Infopark Kochi. 450 companies, 72000+ professionals.'),
  ('cyberpark','Cyberpark','Kozhikode','kozhikode',60,8000,2014,
   'https://cyberpark.kerala.gov.in',
   'Cyberpark Jobs Kozhikode — ddotsjobs.com',
   'Find IT jobs at Cyberpark Kozhikode. 60 companies.')
ON CONFLICT (slug) DO NOTHING;
