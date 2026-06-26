-- 0018_talent — additive. Talent-pool availability signal.
-- urgency_level: 'immediate' | 'one_month' | 'flexible' (nullable = unset).
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20);
