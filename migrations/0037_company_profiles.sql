-- 0037_company_profiles — additive. Employer branding: mission/vision/culture,
-- a banner image, a media gallery, and culture stories. (bio/founded/size/
-- benefits/social already exist from 0023.)
ALTER TABLE employers ADD COLUMN IF NOT EXISTS mission TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS vision TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS culture TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS banner_r2_key TEXT;

CREATE TABLE IF NOT EXISTS company_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  type VARCHAR(15) NOT NULL, -- banner | photo
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_media_employer_idx ON company_media (employer_id);

CREATE TABLE IF NOT EXISTS company_culture_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  story TEXT NOT NULL,
  photo_path TEXT,
  author_name VARCHAR(120),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_stories_employer_idx ON company_culture_stories (employer_id, published_at DESC);
