-- 0016_walkin — additive. Track when a walk-in notice was generated.
ALTER TABLE walk_in_events ADD COLUMN IF NOT EXISTS notice_generated_at TIMESTAMPTZ;
