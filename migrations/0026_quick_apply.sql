-- 0026_quick_apply — one-click application flag.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_quick_apply BOOLEAN NOT NULL DEFAULT false;
