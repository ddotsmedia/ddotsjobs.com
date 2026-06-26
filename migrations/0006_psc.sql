-- 0006_psc — additive. PSC status/exam tracking, FTS, per-category subscriptions.

-- psc_notifications: status + exam date + FTS vector
ALTER TABLE psc_notifications ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
ALTER TABLE psc_notifications ADD COLUMN IF NOT EXISTS exam_date TIMESTAMPTZ;
ALTER TABLE psc_notifications ADD COLUMN IF NOT EXISTS tsv tsvector;
CREATE INDEX IF NOT EXISTS psc_notifications_status_idx ON psc_notifications (status);
CREATE INDEX IF NOT EXISTS psc_notifications_exam_date_idx ON psc_notifications (exam_date);
CREATE INDEX IF NOT EXISTS psc_notifications_tsv_idx ON psc_notifications USING gin (tsv);

CREATE OR REPLACE FUNCTION psc_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv :=
    to_tsvector('simple',
      coalesce(NEW.title_en,'') || ' ' ||
      coalesce(NEW.title_ml,'') || ' ' ||
      coalesce(NEW.department_en,'') || ' ' ||
      coalesce(NEW.qualification_en,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS psc_tsv_trigger ON psc_notifications;
CREATE TRIGGER psc_tsv_trigger
  BEFORE INSERT OR UPDATE OF title_en, title_ml, department_en, qualification_en
  ON psc_notifications
  FOR EACH ROW EXECUTE FUNCTION psc_tsv_update();

-- backfill tsv for any existing rows
UPDATE psc_notifications SET title_en = title_en WHERE tsv IS NULL;

-- psc_subscriptions: per-category subscriptions
ALTER TABLE psc_subscriptions ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(30) NOT NULL DEFAULT 'category';
ALTER TABLE psc_subscriptions ADD COLUMN IF NOT EXISTS subscription_value VARCHAR(60);
ALTER TABLE psc_subscriptions ADD COLUMN IF NOT EXISTS alert_for JSONB NOT NULL
  DEFAULT '["new_notification","exam_date","rank_list","advice"]'::jsonb;

-- replace one-row-per-user uniqueness with one-row-per (user, category)
DROP INDEX IF EXISTS psc_subscriptions_user_uq;
CREATE UNIQUE INDEX IF NOT EXISTS psc_subscriptions_user_value_uq
  ON psc_subscriptions (user_id, subscription_value) WHERE deleted_at IS NULL;
