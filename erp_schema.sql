-- ================================================================
-- UXONIC ERP — Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run (IF NOT EXISTS everywhere).
-- Requires update_updated_at() from supabase_schema.sql.
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- Company settings (single row, id = 1)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_settings (
  id               INT          PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name     TEXT         NOT NULL DEFAULT 'UXONIC Digital Solutions',
  address          TEXT,
  state            TEXT         DEFAULT 'Tamil Nadu',
  state_code       TEXT         DEFAULT '33',
  gstin            TEXT,
  pan              TEXT,
  email            TEXT         DEFAULT 'uxonicdigitalmedia@gmail.com',
  phone            TEXT         DEFAULT '+91 9843021717',
  website          TEXT         DEFAULT 'www.uxonicdigital.com',
  bank_name        TEXT,
  bank_account     TEXT,
  bank_ifsc        TEXT,
  upi_id           TEXT,
  invoice_prefix   TEXT         NOT NULL DEFAULT 'UXN',
  default_gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18,
  invoice_terms    TEXT         DEFAULT 'Payment due within 15 days. Thank you for your business!',
  weekly_off       INT[]        NOT NULL DEFAULT '{0}',   -- 0 = Sunday … 6 = Saturday
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
INSERT INTO erp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- Employees
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_employees (
  id               BIGSERIAL     PRIMARY KEY,
  emp_code         TEXT          NOT NULL UNIQUE,
  full_name        TEXT          NOT NULL,
  email            TEXT,
  phone            TEXT,
  designation      TEXT,
  department       TEXT,
  employment_type  TEXT          NOT NULL DEFAULT 'full-time'
                   CHECK (employment_type IN ('full-time','part-time','intern','contract')),
  join_date        DATE,
  exit_date        DATE,
  monthly_salary   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_salary >= 0),
  bank_name        TEXT,
  bank_account     TEXT,
  bank_ifsc        TEXT,
  pan              TEXT,
  address          TEXT,
  status           TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- Clients
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_clients (
  id           BIGSERIAL   PRIMARY KEY,
  name         TEXT        NOT NULL,
  company      TEXT,
  email        TEXT,
  phone        TEXT,
  gstin        TEXT,
  address      TEXT,
  state        TEXT,
  state_code   TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- Products / apps / client projects
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_products (
  id           BIGSERIAL     PRIMARY KEY,
  name         TEXT          NOT NULL,
  kind         TEXT          NOT NULL DEFAULT 'product'
               CHECK (kind IN ('product','app','client-project','internal')),
  client_id    BIGINT        REFERENCES erp_clients(id) ON DELETE SET NULL,
  status       TEXT          NOT NULL DEFAULT 'active'
               CHECK (status IN ('planning','active','on-hold','completed')),
  start_date   DATE,
  end_date     DATE,
  budget       NUMERIC(12,2),
  description  TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_product_members (
  product_id   BIGINT      NOT NULL REFERENCES erp_products(id)  ON DELETE CASCADE,
  employee_id  BIGINT      NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
  role         TEXT,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, employee_id)
);

-- ----------------------------------------------------------------
-- Attendance (one row per employee per day; product_id = what they worked on)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_attendance (
  id           BIGSERIAL   PRIMARY KEY,
  employee_id  BIGINT      NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  status       TEXT        NOT NULL CHECK (status IN ('present','half-day','absent','leave','holiday')),
  product_id   BIGINT      REFERENCES erp_products(id) ON DELETE SET NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_erp_attendance_date    ON erp_attendance(date);
CREATE INDEX IF NOT EXISTS idx_erp_attendance_product ON erp_attendance(product_id);

-- ----------------------------------------------------------------
-- Payroll (one row per employee per month; month = first day of month)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_payroll (
  id              BIGSERIAL     PRIMARY KEY,
  employee_id     BIGINT        NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
  month           DATE          NOT NULL,
  working_days    NUMERIC(5,1)  NOT NULL DEFAULT 0,
  paid_days       NUMERIC(5,1)  NOT NULL DEFAULT 0,
  present_days    NUMERIC(5,1)  NOT NULL DEFAULT 0,
  half_days       NUMERIC(5,1)  NOT NULL DEFAULT 0,
  leave_days      NUMERIC(5,1)  NOT NULL DEFAULT 0,
  absent_days     NUMERIC(5,1)  NOT NULL DEFAULT 0,
  unmarked_days   NUMERIC(5,1)  NOT NULL DEFAULT 0,
  monthly_salary  NUMERIC(12,2) NOT NULL DEFAULT 0,
  earned          NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances      NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus           NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions      NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay         NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','paid')),
  paid_on         DATE,
  payment_mode    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, month)
);

-- ----------------------------------------------------------------
-- Invoices
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_invoices (
  id           BIGSERIAL     PRIMARY KEY,
  invoice_no   TEXT          NOT NULL UNIQUE,
  client_id    BIGINT        NOT NULL REFERENCES erp_clients(id) ON DELETE RESTRICT,
  product_id   BIGINT        REFERENCES erp_products(id) ON DELETE SET NULL,
  issue_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE,
  gst_rate     NUMERIC(5,2)  NOT NULL DEFAULT 18,
  tax_type     TEXT          NOT NULL DEFAULT 'cgst_sgst' CHECK (tax_type IN ('cgst_sgst','igst','none')),
  subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable      NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst         NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst         NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid  NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       TEXT          NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','sent','partially-paid','paid','cancelled')),
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_client  ON erp_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_product ON erp_invoices(product_id);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_status  ON erp_invoices(status);

CREATE TABLE IF NOT EXISTS erp_invoice_items (
  id           BIGSERIAL     PRIMARY KEY,
  invoice_id   BIGINT        NOT NULL REFERENCES erp_invoices(id) ON DELETE CASCADE,
  position     INT           NOT NULL DEFAULT 1,
  description  TEXT          NOT NULL,
  hsn_sac      TEXT,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  rate         NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_erp_items_invoice ON erp_invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS erp_payments (
  id           BIGSERIAL     PRIMARY KEY,
  invoice_id   BIGINT        NOT NULL REFERENCES erp_invoices(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_on      DATE          NOT NULL DEFAULT CURRENT_DATE,
  mode         TEXT,
  reference    TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_payments_invoice ON erp_payments(invoice_id);

-- ----------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_settings','erp_employees','erp_clients','erp_products','erp_attendance','erp_payroll','erp_invoices']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------
-- Row Level Security: private tables, access only through the API
-- (service_role key on the server bypasses RLS; anon key gets nothing)
-- ----------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_settings','erp_employees','erp_clients','erp_products','erp_product_members',
                           'erp_attendance','erp_payroll','erp_invoices','erp_invoice_items','erp_payments']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS deny_anon_%s ON %I', t, t);
    EXECUTE format('CREATE POLICY deny_anon_%s ON %I FOR ALL TO anon USING (FALSE)', t, t);
  END LOOP;
END $$;

-- ================================================================
-- PART 2 — expenses, quotations, recurring billing, leave, advances,
-- salary history, statutory deductions, tasks, timesheets, portals,
-- staff roles, audit log. Safe to re-run.
-- ================================================================

-- ---------- new columns on existing tables ----------
ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS leave_casual      NUMERIC(5,1) NOT NULL DEFAULT 12;
ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS leave_sick        NUMERIC(5,1) NOT NULL DEFAULT 6;
ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS pf_enabled        BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS esi_enabled       BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS auto_reminders    BOOLEAN      NOT NULL DEFAULT TRUE;
ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS reminder_every_days INT        NOT NULL DEFAULT 7;
ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS quote_prefix      TEXT         NOT NULL DEFAULT 'QT';
ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS portal_url        TEXT         DEFAULT 'https://www.uxonicdigital.com';

ALTER TABLE erp_employees ADD COLUMN IF NOT EXISTS pf_applicable  BOOLEAN      NOT NULL DEFAULT TRUE;
ALTER TABLE erp_employees ADD COLUMN IF NOT EXISTS esi_applicable BOOLEAN      NOT NULL DEFAULT TRUE;
ALTER TABLE erp_employees ADD COLUMN IF NOT EXISTS tds_percent    NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE erp_employees ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN      NOT NULL DEFAULT TRUE;

ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE erp_attendance ADD COLUMN IF NOT EXISTS check_in  TEXT;   -- 'HH:MM' IST
ALTER TABLE erp_attendance ADD COLUMN IF NOT EXISTS check_out TEXT;
ALTER TABLE erp_attendance ADD COLUMN IF NOT EXISTS source    TEXT NOT NULL DEFAULT 'admin';  -- admin | self | leave
ALTER TABLE erp_attendance ADD COLUMN IF NOT EXISTS leave_id  BIGINT;

ALTER TABLE erp_payroll ADD COLUMN IF NOT EXISTS pf                NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE erp_payroll ADD COLUMN IF NOT EXISTS esi               NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE erp_payroll ADD COLUMN IF NOT EXISTS tds               NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE erp_payroll ADD COLUMN IF NOT EXISTS advance_deduction NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS quote_id         BIGINT;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS recurring_id     BIGINT;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS sent_at          TIMESTAMPTZ;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

-- ---------- salary history (keeps old months' cost correct after a raise) ----------
CREATE TABLE IF NOT EXISTS erp_salary_history (
  id              BIGSERIAL     PRIMARY KEY,
  employee_id     BIGINT        NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
  effective_from  DATE          NOT NULL,
  monthly_salary  NUMERIC(12,2) NOT NULL CHECK (monthly_salary >= 0),
  note            TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, effective_from)
);

-- ---------- expenses ----------
CREATE TABLE IF NOT EXISTS erp_expenses (
  id            BIGSERIAL     PRIMARY KEY,
  date          DATE          NOT NULL DEFAULT CURRENT_DATE,
  category      TEXT          NOT NULL,
  vendor        TEXT,
  description   TEXT,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),       -- total paid incl. GST
  gst_amount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  payment_mode  TEXT,
  reference     TEXT,
  product_id    BIGINT        REFERENCES erp_products(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_expenses_date ON erp_expenses(date);

-- ---------- quotations ----------
CREATE TABLE IF NOT EXISTS erp_quotes (
  id           BIGSERIAL     PRIMARY KEY,
  quote_no     TEXT          NOT NULL UNIQUE,
  client_id    BIGINT        NOT NULL REFERENCES erp_clients(id) ON DELETE RESTRICT,
  product_id   BIGINT        REFERENCES erp_products(id) ON DELETE SET NULL,
  issue_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  valid_until  DATE,
  gst_rate     NUMERIC(5,2)  NOT NULL DEFAULT 18,
  tax_type     TEXT          NOT NULL DEFAULT 'cgst_sgst' CHECK (tax_type IN ('cgst_sgst','igst','none')),
  subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable      NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst         NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst         NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       TEXT          NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','sent','accepted','rejected','converted')),
  invoice_id   BIGINT        REFERENCES erp_invoices(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS erp_quote_items (
  id           BIGSERIAL     PRIMARY KEY,
  quote_id     BIGINT        NOT NULL REFERENCES erp_quotes(id) ON DELETE CASCADE,
  position     INT           NOT NULL DEFAULT 1,
  description  TEXT          NOT NULL,
  hsn_sac      TEXT,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  rate         NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_erp_quote_items_quote ON erp_quote_items(quote_id);

-- ---------- recurring invoices ----------
CREATE TABLE IF NOT EXISTS erp_recurring (
  id               BIGSERIAL     PRIMARY KEY,
  title            TEXT          NOT NULL,
  client_id        BIGINT        NOT NULL REFERENCES erp_clients(id) ON DELETE CASCADE,
  product_id       BIGINT        REFERENCES erp_products(id) ON DELETE SET NULL,
  items            JSONB         NOT NULL DEFAULT '[]',
  gst_rate         NUMERIC(5,2)  NOT NULL DEFAULT 18,
  tax_mode         TEXT          NOT NULL DEFAULT 'auto' CHECK (tax_mode IN ('auto','none')),
  discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  interval_months  INT           NOT NULL DEFAULT 1 CHECK (interval_months BETWEEN 1 AND 12),
  due_days         INT           NOT NULL DEFAULT 15,
  next_date        DATE          NOT NULL,
  end_date         DATE,
  active           BOOLEAN       NOT NULL DEFAULT TRUE,
  auto_send        BOOLEAN       NOT NULL DEFAULT FALSE,
  last_invoice_id  BIGINT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------- leave requests ----------
CREATE TABLE IF NOT EXISTS erp_leaves (
  id           BIGSERIAL    PRIMARY KEY,
  employee_id  BIGINT       NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
  leave_type   TEXT         NOT NULL CHECK (leave_type IN ('casual','sick','unpaid')),
  from_date    DATE         NOT NULL,
  to_date      DATE         NOT NULL,
  days         NUMERIC(5,1) NOT NULL DEFAULT 0,
  reason       TEXT,
  status       TEXT         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by   TEXT,
  decided_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (to_date >= from_date)
);
CREATE INDEX IF NOT EXISTS idx_erp_leaves_emp ON erp_leaves(employee_id);

-- ---------- salary advances / loans ----------
CREATE TABLE IF NOT EXISTS erp_advances (
  id                 BIGSERIAL     PRIMARY KEY,
  employee_id        BIGINT        NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
  given_on           DATE          NOT NULL DEFAULT CURRENT_DATE,
  amount             NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  monthly_deduction  NUMERIC(12,2) NOT NULL CHECK (monthly_deduction > 0),
  recovered          NUMERIC(12,2) NOT NULL DEFAULT 0,
  note               TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS erp_advance_recoveries (
  id          BIGSERIAL     PRIMARY KEY,
  advance_id  BIGINT        NOT NULL REFERENCES erp_advances(id) ON DELETE CASCADE,
  payroll_id  BIGINT        NOT NULL REFERENCES erp_payroll(id)  ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------- tasks (kanban per product) ----------
CREATE TABLE IF NOT EXISTS erp_tasks (
  id           BIGSERIAL   PRIMARY KEY,
  product_id   BIGINT      NOT NULL REFERENCES erp_products(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  assignee_id  BIGINT      REFERENCES erp_employees(id) ON DELETE SET NULL,
  status       TEXT        NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','review','done')),
  priority     TEXT        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  due_date     DATE,
  is_milestone BOOLEAN     NOT NULL DEFAULT FALSE,
  client_visible BOOLEAN   NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_tasks_product ON erp_tasks(product_id);

-- ---------- hourly timesheets ----------
CREATE TABLE IF NOT EXISTS erp_timesheets (
  id           BIGSERIAL    PRIMARY KEY,
  employee_id  BIGINT       NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
  date         DATE         NOT NULL,
  product_id   BIGINT       NOT NULL REFERENCES erp_products(id) ON DELETE CASCADE,
  task_id      BIGINT       REFERENCES erp_tasks(id) ON DELETE SET NULL,
  hours        NUMERIC(4,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  note         TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_timesheets_emp_date ON erp_timesheets(employee_id, date);

-- ---------- ERP staff users & roles ----------
CREATE TABLE IF NOT EXISTS erp_users (
  id          BIGSERIAL   PRIMARY KEY,
  email       TEXT        NOT NULL UNIQUE,
  full_name   TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('admin','hr','accountant')),
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- one-time passwords for staff / employee / client logins ----------
CREATE TABLE IF NOT EXISTS erp_otps (
  id          BIGSERIAL   PRIMARY KEY,
  kind        TEXT        NOT NULL CHECK (kind IN ('staff','employee','client')),
  email       TEXT        NOT NULL,
  otp_hash    TEXT        NOT NULL,
  attempts    INT         NOT NULL DEFAULT 0,
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_otps_lookup ON erp_otps(kind, email, created_at DESC);

-- ---------- audit log ----------
CREATE TABLE IF NOT EXISTS erp_audit (
  id          BIGSERIAL   PRIMARY KEY,
  actor       TEXT        NOT NULL,
  actor_role  TEXT,
  action      TEXT        NOT NULL,      -- POST / PUT / DELETE / login …
  resource    TEXT        NOT NULL,
  record_id   TEXT,
  summary     TEXT,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_audit_created ON erp_audit(created_at DESC);

-- ---------- triggers + RLS for the new tables ----------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_expenses','erp_quotes','erp_recurring','erp_leaves','erp_advances','erp_tasks','erp_users']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['erp_salary_history','erp_expenses','erp_quotes','erp_quote_items','erp_recurring','erp_leaves',
                           'erp_advances','erp_advance_recoveries','erp_tasks','erp_timesheets','erp_users','erp_otps','erp_audit']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS deny_anon_%s ON %I', t, t);
    EXECUTE format('CREATE POLICY deny_anon_%s ON %I FOR ALL TO anon USING (FALSE)', t, t);
  END LOOP;
END $$;

-- ================================================================
-- END OF ERP SCHEMA
-- ================================================================
