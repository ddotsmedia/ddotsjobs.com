-- 0047_scheduled_reports — additive. Employer scheduled analytics email reports.

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  report_type VARCHAR(30) NOT NULL, -- hiring_funnel | applicant_source | time_to_hire
  frequency VARCHAR(10) NOT NULL,   -- weekly | monthly
  send_at VARCHAR(40),              -- cron expression (display; actual run via fixed crons)
  recipients TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_reports_employer_freq_idx ON scheduled_reports (employer_id, frequency);
CREATE INDEX IF NOT EXISTS scheduled_reports_active_freq_idx ON scheduled_reports (frequency, is_active);
