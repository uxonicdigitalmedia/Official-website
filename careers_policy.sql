-- ================================================================
-- UXONIC — Allow public read of active job postings
-- Run in Supabase SQL Editor (required for careers page anon access)
-- ================================================================

-- Drop the blanket deny if it blocks SELECT (recreate write denials separately)
DROP POLICY IF EXISTS "deny_anon_jobs" ON job_postings;
DROP POLICY IF EXISTS "public_read_active_jobs" ON job_postings;

-- Public can read ONLY active jobs
CREATE POLICY "public_read_active_jobs"
  ON job_postings
  FOR SELECT
  TO anon
  USING (status = 'active');

-- Anon cannot insert/update/delete
DROP POLICY IF EXISTS "deny_anon_jobs_write" ON job_postings;
CREATE POLICY "deny_anon_jobs_insert" ON job_postings FOR INSERT TO anon WITH CHECK (FALSE);
CREATE POLICY "deny_anon_jobs_update" ON job_postings FOR UPDATE TO anon USING (FALSE);
CREATE POLICY "deny_anon_jobs_delete" ON job_postings FOR DELETE TO anon USING (FALSE);
