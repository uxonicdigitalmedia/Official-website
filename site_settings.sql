-- ================================================================
-- UXONIC — Site Settings Table (full website CMS keys)
-- Run in Supabase SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT,
  label      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default settings — homepage + contact + join team
INSERT INTO site_settings (key, value, label) VALUES
  ('hero_badge',         'Premium Digital Agency in 2025', 'Hero — Badge text'),
  ('hero_headline',      'We Build Digital<br>Experiences That <span class="highlight-serif">Actually</span> Convert', 'Hero — Headline (HTML allowed)'),
  ('hero_subtitle',      'From stunning websites & apps to AI-powered automation — UXONIC transforms your vision into a premium digital reality that drives real growth.', 'Hero — Subtitle'),
  ('contact_email',      'uxonicdigitalmedia@gmail.com', 'Contact — Email'),
  ('contact_phone',      '+91 9843021717', 'Contact — Phone / WhatsApp display'),
  ('whatsapp_number',    '919843021717', 'WhatsApp — Number (digits only with country code)'),
  ('join_team_image',    'images/ceo.png', 'Join Our Team — Section Image URL'),
  ('join_team_heading',  'Join Our Team', 'Join Our Team — Heading'),
  ('join_team_subtext',  'We''re looking for passionate, driven individuals ready to make a real impact. Whether you''re a student or a professional — there''s a place for you at UXONIC.', 'Join Our Team — Description'),
  ('join_team_visible',  'true', 'Join Our Team — Show Section (true/false)')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Public can READ settings (safe for marketing copy)
DROP POLICY IF EXISTS "public_read_settings" ON site_settings;
CREATE POLICY "public_read_settings"
  ON site_settings FOR SELECT TO anon USING (TRUE);

-- Anon cannot write
DROP POLICY IF EXISTS "deny_anon_write_settings" ON site_settings;
CREATE POLICY "deny_anon_write_settings"
  ON site_settings FOR INSERT TO anon WITH CHECK (FALSE);
CREATE POLICY "deny_anon_update_settings"
  ON site_settings FOR UPDATE TO anon USING (FALSE);
CREATE POLICY "deny_anon_delete_settings"
  ON site_settings FOR DELETE TO anon USING (FALSE);
