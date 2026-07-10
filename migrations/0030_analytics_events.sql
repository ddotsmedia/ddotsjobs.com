-- 0030_analytics_events — additive. Time-series employer analytics events.
-- Powers the employer analytics dashboard (job views, profile views, apply CTA
-- clicks). Actual applications remain authoritative in the applications table;
-- this table adds per-event timestamps for timeline charts and funnels.
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  -- job_view | profile_view | apply | apply_cta_click
  event_type VARCHAR(30) NOT NULL,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewer_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_employer_idx ON analytics_events (employer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_type_idx ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS analytics_events_job_idx ON analytics_events (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON analytics_events (created_at DESC);
