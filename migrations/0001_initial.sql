-- ════════════════════════════════════════════════════════════════════════
-- ddotsjobs 0001_initial
-- Additive only. Safe to re-run within the migration runner's tracking guard.
-- Cluster: isolated PostgreSQL 16 (port 5436), DB ddotsjobs.
-- ════════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram fuzzy search

-- ── Enums (idempotent via DO blocks) ────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('seeker','employer','admin','moderator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE employer_type AS ENUM ('direct','consultancy','gulf_agency','government','staffing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_type AS ENUM ('full_time','part_time','contract','walk_in','gulf','internship','temporary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('draft','pending_review','active','paused','filled','expired','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('applied','viewed','shortlisted','interview','offered','hired','rejected','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('unverified','pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE professional_registration_type AS ENUM ('nurses_council','medical_council','pharmacy_council','bar_council','engineering_board','teaching_eligibility','iti_ncvt','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE alert_channel AS ENUM ('whatsapp','email','push','sms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE alert_frequency AS ENUM ('instant','daily','weekly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('created','authorized','captured','failed','refunded','partially_refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free','seeker_plus','employer_basic','employer_pro','employer_enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE district AS ENUM ('thiruvananthapuram','kollam','pathanamthitta','alappuzha','kottayam','idukki','ernakulam','thrissur','palakkad','malappuram','kozhikode','wayanad','kannur','kasaragod');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gulf_country AS ENUM ('uae','saudi_arabia','qatar','kuwait','oman','bahrain');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE it_park AS ENUM ('technopark','infopark','cyberpark','kinfra','ust_global_campus','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE visibility_level AS ENUM ('public','registered','verified_only','private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE content_language AS ENUM ('ml','en');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Trigger functions ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION jobs_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.title_en,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.title_ml,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.location_text,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description_en,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.description_ml,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(
      ARRAY(SELECT jsonb_array_elements_text(NEW.skills)), ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════════════
-- Tables
-- ════════════════════════════════════════════════════════════════════════

-- ── users ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role               user_role NOT NULL DEFAULT 'seeker',
  phone              VARCHAR(20) NOT NULL,
  email              VARCHAR(255),
  password_hash      TEXT,
  name_ml            VARCHAR(200),
  name_en            VARCHAR(200),
  preferred_language content_language NOT NULL DEFAULT 'ml',
  phone_verified     BOOLEAN NOT NULL DEFAULT false,
  email_verified     BOOLEAN NOT NULL DEFAULT false,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uq ON users (phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- ── seeker_profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seeker_profiles (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  headline_ml                VARCHAR(255),
  headline_en                VARCHAR(255),
  summary_ml                 TEXT,
  summary_en                 TEXT,
  home_district              district,
  current_district           district,
  willing_to_relocate        BOOLEAN NOT NULL DEFAULT false,
  open_to_gulf               BOOLEAN NOT NULL DEFAULT false,
  years_experience           VARCHAR(10),
  expected_salary_min_paise  BIGINT,
  expected_salary_max_paise  BIGINT,
  skills                     JSONB NOT NULL DEFAULT '[]'::jsonb,
  resume_r2_key              TEXT,
  profile_complete           BOOLEAN NOT NULL DEFAULT false,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                 TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS seeker_profiles_user_uq ON seeker_profiles (user_id);
CREATE INDEX IF NOT EXISTS seeker_profiles_home_district_idx ON seeker_profiles (home_district);

-- ── professional_registrations ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS professional_registrations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_profile_id    UUID NOT NULL REFERENCES seeker_profiles(id) ON DELETE CASCADE,
  type                 professional_registration_type NOT NULL,
  registration_number  VARCHAR(100) NOT NULL,
  issuing_body         VARCHAR(200),
  valid_until          TIMESTAMPTZ,
  status               verification_status NOT NULL DEFAULT 'unverified',
  verified_at          TIMESTAMPTZ,
  document_r2_key      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS prof_reg_seeker_idx ON professional_registrations (seeker_profile_id);
CREATE INDEX IF NOT EXISTS prof_reg_type_idx ON professional_registrations (type);

-- ── employers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type                     employer_type NOT NULL DEFAULT 'direct',
  legal_name_en            VARCHAR(255) NOT NULL,
  display_name_ml          VARCHAR(255),
  display_name_en          VARCHAR(255),
  description_ml           TEXT,
  description_en           TEXT,
  website_url              TEXT,
  logo_r2_key              TEXT,
  district                 district,
  it_park                  it_park,
  gstin                    VARCHAR(20),
  recruitment_licence_no   VARCHAR(100),
  verification_status      verification_status NOT NULL DEFAULT 'unverified',
  verified_at              TIMESTAMPTZ,
  is_blacklisted           BOOLEAN NOT NULL DEFAULT false,
  contact_phone            VARCHAR(20),
  contact_email            VARCHAR(255),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS employers_owner_idx ON employers (owner_user_id);
CREATE INDEX IF NOT EXISTS employers_type_idx ON employers (type);
CREATE INDEX IF NOT EXISTS employers_district_idx ON employers (district);
CREATE UNIQUE INDEX IF NOT EXISTS employers_gstin_uq ON employers (gstin) WHERE gstin IS NOT NULL AND deleted_at IS NULL;

-- ── jobs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id            UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title_ml               VARCHAR(255),
  title_en               VARCHAR(255) NOT NULL,
  description_ml         TEXT,
  description_en         TEXT NOT NULL,
  type                   job_type NOT NULL DEFAULT 'full_time',
  status                 job_status NOT NULL DEFAULT 'draft',
  visibility             visibility_level NOT NULL DEFAULT 'public',
  district               district,
  it_park                it_park,
  gulf_country           gulf_country,
  location_text          VARCHAR(255),
  is_remote              BOOLEAN NOT NULL DEFAULT false,
  salary_min_paise       BIGINT,
  salary_max_paise       BIGINT,
  salary_period          VARCHAR(20) NOT NULL DEFAULT 'monthly',
  vacancies              INTEGER NOT NULL DEFAULT 1,
  min_experience_years   SMALLINT NOT NULL DEFAULT 0,
  skills                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_slug          VARCHAR(100),
  application_deadline   TIMESTAMPTZ,
  published_at           TIMESTAMPTZ,
  expires_at             TIMESTAMPTZ,
  view_count             INTEGER NOT NULL DEFAULT 0,
  application_count      INTEGER NOT NULL DEFAULT 0,
  is_walk_in             BOOLEAN NOT NULL DEFAULT false,
  tsv                    tsvector,
  embedding              vector(1536),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS jobs_employer_idx ON jobs (employer_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_type_idx ON jobs (type);
CREATE INDEX IF NOT EXISTS jobs_district_idx ON jobs (district);
CREATE INDEX IF NOT EXISTS jobs_category_idx ON jobs (category_slug);
CREATE INDEX IF NOT EXISTS jobs_published_at_idx ON jobs (published_at);
CREATE INDEX IF NOT EXISTS jobs_tsv_idx ON jobs USING gin (tsv);
CREATE INDEX IF NOT EXISTS jobs_title_en_trgm_idx ON jobs USING gin (title_en gin_trgm_ops);
-- IVFFlat for cosine similarity. Tune `lists` after data lands; built lazily.
CREATE INDEX IF NOT EXISTS jobs_embedding_idx ON jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── walk_in_events ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS walk_in_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  venue_ml          VARCHAR(255),
  venue_en          VARCHAR(255) NOT NULL,
  district          district,
  address_text      TEXT,
  latitude          REAL,
  longitude         REAL,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ,
  contact_phone     VARCHAR(20),
  instructions_ml   TEXT,
  instructions_en   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS walk_in_events_job_idx ON walk_in_events (job_id);
CREATE INDEX IF NOT EXISTS walk_in_events_starts_at_idx ON walk_in_events (starts_at);

-- ── applications ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  seeker_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status             application_status NOT NULL DEFAULT 'applied',
  cover_note_ml      TEXT,
  cover_note_en      TEXT,
  resume_r2_key      TEXT,
  fit_score          SMALLINT,
  status_history     JSONB NOT NULL DEFAULT '[]'::jsonb,
  employer_note      TEXT,
  applied_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_changed_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS applications_job_seeker_uq ON applications (job_id, seeker_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS applications_job_idx ON applications (job_id);
CREATE INDEX IF NOT EXISTS applications_seeker_idx ON applications (seeker_user_id);
CREATE INDEX IF NOT EXISTS applications_status_idx ON applications (status);

-- ── fit_scores ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fit_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  seeker_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score            SMALLINT NOT NULL,
  breakdown        JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale_ml     TEXT,
  rationale_en     TEXT,
  model_id         VARCHAR(60) NOT NULL,
  prompt_version   INTEGER NOT NULL DEFAULT 1,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS fit_scores_job_seeker_uq ON fit_scores (job_id, seeker_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS fit_scores_seeker_idx ON fit_scores (seeker_user_id);

-- ── salary_data_points ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_data_points (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug     VARCHAR(100) NOT NULL,
  title_en          VARCHAR(255),
  district          district,
  it_park           it_park,
  years_experience  SMALLINT,
  amount_paise      BIGINT NOT NULL,
  period            VARCHAR(20) NOT NULL DEFAULT 'monthly',
  source            VARCHAR(60) NOT NULL DEFAULT 'self_reported',
  job_id            UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS salary_dp_category_idx ON salary_data_points (category_slug);
CREATE INDEX IF NOT EXISTS salary_dp_district_idx ON salary_data_points (district);

-- ── company_reviews ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id           UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  author_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating                SMALLINT NOT NULL,
  title_ml              VARCHAR(255),
  title_en              VARCHAR(255),
  body_ml               TEXT,
  body_en               TEXT,
  is_anonymous          BOOLEAN NOT NULL DEFAULT true,
  is_verified_employee  BOOLEAN NOT NULL DEFAULT false,
  helpful_count         INTEGER NOT NULL DEFAULT 0,
  status                verification_status NOT NULL DEFAULT 'pending',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  CONSTRAINT company_reviews_rating_chk CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX IF NOT EXISTS company_reviews_employer_idx ON company_reviews (employer_id);
CREATE UNIQUE INDEX IF NOT EXISTS company_reviews_author_employer_uq ON company_reviews (author_user_id, employer_id) WHERE deleted_at IS NULL;

-- ── employer_seeker_contacts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employer_seeker_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id     UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  seeker_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  channel         VARCHAR(30) NOT NULL,
  note            TEXT,
  cost_paise      BIGINT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS emp_seeker_contacts_employer_idx ON employer_seeker_contacts (employer_id);
CREATE INDEX IF NOT EXISTS emp_seeker_contacts_seeker_idx ON employer_seeker_contacts (seeker_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS emp_seeker_contacts_uq ON employer_seeker_contacts (employer_id, seeker_user_id, job_id) WHERE deleted_at IS NULL;

-- ── alert_subscriptions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label_ml            VARCHAR(200),
  label_en            VARCHAR(200),
  channel             alert_channel NOT NULL DEFAULT 'whatsapp',
  frequency           alert_frequency NOT NULL DEFAULT 'daily',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_dispatched_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS alert_subs_seeker_idx ON alert_subscriptions (seeker_user_id);
CREATE INDEX IF NOT EXISTS alert_subs_active_idx ON alert_subscriptions (is_active);

-- ── alert_filters ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_filters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  field            VARCHAR(60) NOT NULL,
  operator         VARCHAR(20) NOT NULL DEFAULT 'eq',
  value            JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS alert_filters_subscription_idx ON alert_filters (subscription_id);

-- ── alert_dispatch_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_dispatch_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id      UUID NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  job_id               UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  channel              alert_channel NOT NULL,
  dispatched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_status      VARCHAR(30) NOT NULL DEFAULT 'queued',
  provider_message_id  TEXT,
  error                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS alert_dispatch_subscription_idx ON alert_dispatch_log (subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS alert_dispatch_uq ON alert_dispatch_log (subscription_id, job_id, channel) WHERE deleted_at IS NULL;

-- ── psc_notifications ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psc_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_number     VARCHAR(40) NOT NULL,
  title_ml            TEXT,
  title_en            TEXT NOT NULL,
  department_ml       VARCHAR(255),
  department_en       VARCHAR(255),
  description_ml      TEXT,
  description_en      TEXT,
  scale_of_pay        VARCHAR(120),
  qualification_en    TEXT,
  district            district,
  vacancies           INTEGER,
  last_date_to_apply  TIMESTAMPTZ,
  source_url          TEXT,
  gazette_date        TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS psc_notifications_category_uq ON psc_notifications (category_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS psc_notifications_active_idx ON psc_notifications (is_active);
CREATE INDEX IF NOT EXISTS psc_notifications_last_date_idx ON psc_notifications (last_date_to_apply);

-- ── psc_subscriptions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psc_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     alert_channel NOT NULL DEFAULT 'whatsapp',
  filters     JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS psc_subscriptions_user_uq ON psc_subscriptions (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS psc_subscriptions_active_idx ON psc_subscriptions (is_active);

-- ── psc_rank_tracker ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psc_rank_tracker (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id  UUID REFERENCES psc_notifications(id) ON DELETE SET NULL,
  rank_list_name   VARCHAR(255) NOT NULL,
  roll_number      VARCHAR(60),
  rank             INTEGER,
  district         district,
  published_at     TIMESTAMPTZ,
  advices_made     INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS psc_rank_tracker_user_idx ON psc_rank_tracker (user_id);
CREATE INDEX IF NOT EXISTS psc_rank_tracker_notification_idx ON psc_rank_tracker (notification_id);

-- ── norka_schemes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS norka_schemes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(120) NOT NULL,
  title_ml        TEXT,
  title_en        TEXT NOT NULL,
  summary_ml      TEXT,
  summary_en      TEXT,
  eligibility_ml  TEXT,
  eligibility_en  TEXT,
  benefits_ml     TEXT,
  benefits_en     TEXT,
  apply_url       TEXT,
  category        VARCHAR(80),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS norka_schemes_slug_uq ON norka_schemes (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS norka_schemes_active_idx ON norka_schemes (is_active);

-- ── pravasi_profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pravasi_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_country          gulf_country,
  is_returnee              BOOLEAN NOT NULL DEFAULT false,
  returned_at              TIMESTAMPTZ,
  passport_number_masked   VARCHAR(30),
  emigration_clearance     BOOLEAN NOT NULL DEFAULT false,
  norka_id_masked          VARCHAR(60),
  preferred_countries      JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills_gulf              JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS pravasi_profiles_user_uq ON pravasi_profiles (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pravasi_profiles_country_idx ON pravasi_profiles (current_country);

-- ── pravasi_work_history ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pravasi_work_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pravasi_profile_id  UUID NOT NULL REFERENCES pravasi_profiles(id) ON DELETE CASCADE,
  employer_name       VARCHAR(255),
  country             gulf_country,
  title_en            VARCHAR(255),
  title_local         VARCHAR(255),
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  last_salary_paise   BIGINT,
  currency_code       VARCHAR(3),
  description_en      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS pravasi_work_history_profile_idx ON pravasi_work_history (pravasi_profile_id);

-- ── gulf_title_translations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gulf_title_translations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_title        VARCHAR(255) NOT NULL,
  country             gulf_country,
  canonical_title_en  VARCHAR(255) NOT NULL,
  canonical_title_ml  VARCHAR(255),
  category_slug       VARCHAR(100),
  confidence          VARCHAR(10),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS gulf_title_translations_uq ON gulf_title_translations (source_title, country) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS gulf_title_translations_category_idx ON gulf_title_translations (category_slug);

-- ── subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tier                     subscription_tier NOT NULL DEFAULT 'free',
  price_paise              BIGINT NOT NULL DEFAULT 0,
  razorpay_subscription_id VARCHAR(80),
  status                   VARCHAR(30) NOT NULL DEFAULT 'active',
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     JSONB NOT NULL DEFAULT 'false'::jsonb,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_tier_idx ON subscriptions (tier);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_razorpay_uq ON subscriptions (razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;

-- ── payments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subscription_id        UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_paise           BIGINT NOT NULL,
  currency               VARCHAR(3) NOT NULL DEFAULT 'INR',
  status                 payment_status NOT NULL DEFAULT 'created',
  razorpay_order_id      VARCHAR(80),
  razorpay_payment_id    VARCHAR(80),
  razorpay_signature     TEXT,
  purpose                VARCHAR(60) NOT NULL DEFAULT 'subscription',
  refunded_amount_paise  BIGINT NOT NULL DEFAULT 0,
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_order_uq ON payments (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_payment_uq ON payments (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- ── audit_log (append-only, no soft delete) ─────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(80) NOT NULL,
  entity_id       UUID,
  diff            JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address      VARCHAR(64),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at);

-- ════════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════════

-- updated_at maintenance on every mutable table (all except audit_log).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','seeker_profiles','professional_registrations','employers','jobs',
    'walk_in_events','applications','fit_scores','salary_data_points',
    'company_reviews','employer_seeker_contacts','alert_subscriptions',
    'alert_filters','alert_dispatch_log','psc_notifications','psc_subscriptions',
    'psc_rank_tracker','norka_schemes','pravasi_profiles','pravasi_work_history',
    'gulf_title_translations','subscriptions','payments'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%1$s ON %1$s;', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at_%1$s BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;

-- jobs full-text search vector maintenance.
DROP TRIGGER IF EXISTS jobs_tsv_trigger ON jobs;
CREATE TRIGGER jobs_tsv_trigger
  BEFORE INSERT OR UPDATE OF title_en, title_ml, description_en, description_ml, location_text, skills
  ON jobs
  FOR EACH ROW EXECUTE FUNCTION jobs_tsv_update();
