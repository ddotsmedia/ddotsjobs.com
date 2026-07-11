-- 0039_interview_analysis — additive. AI analysis of video interviews.
-- ai_analysis holds { sentiment, engagement, topics, score, summary }.
-- transcript holds the per-answer text the analysis runs on.
--
-- NOTE: automatic speech-to-text (ffmpeg + Whisper) is NOT wired — the VPS has
-- no ffmpeg and no ASR key. Transcripts are entered per answer for now; the AI
-- analysis engine runs on whatever transcript text exists. Auto-transcription
-- (Whisper API or Gemini audio) is a separate infra follow-up.
ALTER TABLE video_interviews ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
ALTER TABLE interview_videos ADD COLUMN IF NOT EXISTS transcript TEXT;
