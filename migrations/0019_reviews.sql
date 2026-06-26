-- 0019_reviews — additive. Sub-rating dimensions on the existing
-- company_reviews table (overall rating, author, body already exist from 0001).
ALTER TABLE company_reviews ADD COLUMN IF NOT EXISTS rating_work_culture SMALLINT
  CHECK (rating_work_culture BETWEEN 1 AND 5);
ALTER TABLE company_reviews ADD COLUMN IF NOT EXISTS rating_work_life_balance SMALLINT
  CHECK (rating_work_life_balance BETWEEN 1 AND 5);
ALTER TABLE company_reviews ADD COLUMN IF NOT EXISTS rating_pay SMALLINT
  CHECK (rating_pay BETWEEN 1 AND 5);
ALTER TABLE company_reviews ADD COLUMN IF NOT EXISTS rating_women_friendly SMALLINT
  CHECK (rating_women_friendly BETWEEN 1 AND 5);
