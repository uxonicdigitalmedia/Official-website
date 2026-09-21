-- ================================================================
-- UXONIC — OTP Table for Admin Login
-- Run in Supabase SQL Editor AFTER supabase_schema.sql
-- ================================================================

CREATE TABLE IF NOT EXISTS admin_otps (
  id         BIGSERIAL    PRIMARY KEY,
  email      TEXT         NOT NULL,
  otp_hash   TEXT         NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  used       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_email      ON admin_otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON admin_otps(expires_at);

-- RLS — block all public access
ALTER TABLE admin_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon_otps" ON admin_otps FOR ALL TO anon USING (FALSE);

-- Auto-cleanup: delete expired OTPs (run periodically or via cron)
-- DELETE FROM admin_otps WHERE expires_at < NOW();
