-- ================================================================
-- UXONIC Digital Solutions — Supabase Schema (PostgreSQL)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- ----------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------
-- TABLE: admin_users
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username     TEXT        NOT NULL UNIQUE,
  password_hash TEXT       NOT NULL,
  full_name    TEXT        NOT NULL DEFAULT 'UXONIC Admin',
  role         TEXT        NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin','admin')),
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE: internship_applications
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internship_applications (
  id           BIGSERIAL   PRIMARY KEY,
  full_name    TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  mobile       TEXT        NOT NULL,
  location     TEXT        NOT NULL,
  college      TEXT,
  degree       TEXT,
  grad_year    TEXT,
  sales_exp    TEXT        NOT NULL DEFAULT 'No' CHECK (sales_exp IN ('Yes','No')),
  linkedin     TEXT,
  why_uxonic   TEXT,
  resume_path  TEXT,
  resume_name  TEXT,
  status       TEXT        NOT NULL DEFAULT 'new'
               CHECK (status IN ('new','reviewing','shortlisted','rejected','hired')),
  admin_notes  TEXT,
  ip_address   TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON internship_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_applications_status       ON internship_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON internship_applications(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_email        ON internship_applications(email);

-- ----------------------------------------------------------------
-- TABLE: job_postings
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_postings (
  id               BIGSERIAL   PRIMARY KEY,
  title            TEXT        NOT NULL,
  department       TEXT,
  location         TEXT        NOT NULL DEFAULT 'Remote / Tamil Nadu',
  job_type         TEXT        NOT NULL DEFAULT 'full-time'
                   CHECK (job_type IN ('full-time','part-time','internship','contract','freelance')),
  experience       TEXT,
  salary           TEXT,
  description      TEXT,
  requirements     TEXT,
  responsibilities TEXT,
  skills           TEXT,
  apply_url        TEXT,
  status           TEXT        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','closed')),
  posted_at        TIMESTAMPTZ,
  expires_at       DATE,
  created_by       UUID        REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_jobs_status ON job_postings(status);

-- ----------------------------------------------------------------
-- TABLE: contact_submissions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_submissions (
  id           BIGSERIAL   PRIMARY KEY,
  full_name    TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  project_type TEXT,
  message      TEXT        NOT NULL,
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  admin_notes  TEXT,
  ip_address   TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_is_read      ON contact_submissions(is_read);
CREATE INDEX IF NOT EXISTS idx_contacts_submitted_at ON contact_submissions(submitted_at DESC);

-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- All tables private — access only via service_role key (server-side)
-- ----------------------------------------------------------------
ALTER TABLE admin_users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions      ENABLE ROW LEVEL SECURITY;

-- Block all access via anon/public key
CREATE POLICY "deny_anon_admin_users"    ON admin_users             FOR ALL TO anon USING (FALSE);
CREATE POLICY "deny_anon_applications"   ON internship_applications  FOR ALL TO anon USING (FALSE);
-- Jobs: allow public SELECT of active rows (see careers_policy.sql); deny writes
CREATE POLICY "deny_anon_jobs_insert" ON job_postings FOR INSERT TO anon WITH CHECK (FALSE);
CREATE POLICY "deny_anon_jobs_update" ON job_postings FOR UPDATE TO anon USING (FALSE);
CREATE POLICY "deny_anon_jobs_delete" ON job_postings FOR DELETE TO anon USING (FALSE);
CREATE POLICY "public_read_active_jobs" ON job_postings FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "deny_anon_contacts"       ON contact_submissions      FOR ALL TO anon USING (FALSE);

-- ----------------------------------------------------------------
-- SUPABASE STORAGE BUCKET: resumes
-- Run this AFTER creating the bucket in Storage UI
-- ----------------------------------------------------------------
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('resumes', 'resumes', false);
--
-- CREATE POLICY "deny_public_resume_read"
--   ON storage.objects FOR SELECT TO anon USING (FALSE);

-- ================================================================
-- END OF SCHEMA
-- ================================================================
