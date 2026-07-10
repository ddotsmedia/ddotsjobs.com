-- 0036_video_interviews — additive. Async video interviews: employer creates a
-- question set, candidate records answers (one video per question), employer
-- reviews playback.
CREATE TABLE IF NOT EXISTS video_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- employer owner
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- seeker
  status VARCHAR(15) NOT NULL DEFAULT 'scheduled', -- scheduled | recording | submitted | reviewed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS video_interviews_job_idx ON video_interviews (job_id, status);
CREATE INDEX IF NOT EXISTS video_interviews_candidate_idx ON video_interviews (candidate_id, status);
CREATE INDEX IF NOT EXISTS video_interviews_interviewer_idx ON video_interviews (interviewer_id, status);

CREATE TABLE IF NOT EXISTS interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES video_interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  time_limit INTEGER NOT NULL DEFAULT 120, -- seconds
  "order" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS interview_questions_interview_idx ON interview_questions (interview_id, "order");

CREATE TABLE IF NOT EXISTS interview_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES video_interviews(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  duration INTEGER,
  transcript_url TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS interview_videos_q_uq ON interview_videos (interview_id, question_id);
