-- 0045_perf_indexes — additive. Composite indexes for hot filter/sort paths.
-- Chat inbox (participant_a/b, last_message_at) and messages (conversation_id,
-- created_at) are ALREADY indexed (0032) — not repeated here.

-- Public job listing filters by category + district + salary range.
CREATE INDEX IF NOT EXISTS jobs_category_district_salary_idx
  ON jobs (category_slug, district, salary_min_paise, salary_max_paise);

-- Active-listing sort: WHERE status = 'active' ORDER BY published_at.
CREATE INDEX IF NOT EXISTS jobs_status_published_idx
  ON jobs (status, published_at);

-- ATS pipeline groups applicants by stage within a job.
CREATE INDEX IF NOT EXISTS applications_job_stage_idx
  ON applications (job_id, stage);
