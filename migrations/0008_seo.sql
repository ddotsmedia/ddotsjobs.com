-- 0008_seo — additive. Track Google Indexing API submission per job.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS google_indexed_at TIMESTAMPTZ;
