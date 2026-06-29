-- 0025_broadcast_log — admin WhatsApp broadcast records.
CREATE TABLE IF NOT EXISTS broadcast_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  target_groups TEXT[] NOT NULL,
  broadcast_type TEXT NOT NULL DEFAULT 'announcement',
  status TEXT NOT NULL DEFAULT 'queued',
  estimated_reach INTEGER NOT NULL DEFAULT 0,
  actual_reach INTEGER NOT NULL DEFAULT 0,
  sent_by_user_id UUID REFERENCES users(id),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_broadcast_log_created ON broadcast_log (created_at DESC);
