-- 019_work_order_schema_and_rls.sql
-- Foundation for photo-linked work orders + status tracking with org-scoped RLS

-- Ensure required extension for UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

------------------------------------------------------------
-- hr.work_orders: add missing columns (idempotent)
------------------------------------------------------------
ALTER TABLE hr.work_orders
  ADD COLUMN IF NOT EXISTS created_by_uid text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS tenant_photo_s3_key text,
  ADD COLUMN IF NOT EXISTS tenant_photo_filename text,
  ADD COLUMN IF NOT EXISTS completion_photo_s3_key text,
  ADD COLUMN IF NOT EXISTS completion_photo_filename text,
  ADD COLUMN IF NOT EXISTS estimated_hours numeric(4,2),
  ADD COLUMN IF NOT EXISTS actual_hours numeric(4,2),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_org ON hr.work_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON hr.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_completed_at ON hr.work_orders(completed_at);

-- Enable RLS safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'hr' AND tablename = 'work_orders' AND rowsecurity = true
  ) THEN
    EXECUTE 'ALTER TABLE hr.work_orders ENABLE ROW LEVEL SECURITY';
  END IF;
END$$;

-- Create or ensure an org policy exists (USING + WITH CHECK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'hr' AND tablename = 'work_orders' AND policyname = 'work_orders_org_rls'
  ) THEN
    EXECUTE $$pol$
      CREATE POLICY work_orders_org_rls ON hr.work_orders
      USING (organization_id = current_setting('app.current_organization', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);
    $pol$$;
  END IF;
END$$;

------------------------------------------------------------
-- hr.work_order_status_history: status transition log
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr.work_order_status_history (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL,
  work_order_id uuid NOT NULL REFERENCES hr.work_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by_uid text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wosh_org ON hr.work_order_status_history(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wosh_wo ON hr.work_order_status_history(work_order_id, created_at);

ALTER TABLE hr.work_order_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'hr' AND tablename = 'work_order_status_history' AND policyname = 'wosh_org_rls'
  ) THEN
    EXECUTE $$pol$
      CREATE POLICY wosh_org_rls ON hr.work_order_status_history
      USING (organization_id = current_setting('app.current_organization', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);
    $pol$$;
  END IF;
END$$;

------------------------------------------------------------
-- hr.technicians: update existing table with missing fields
------------------------------------------------------------
-- Add missing fields to existing technicians table
ALTER TABLE hr.technicians
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Update full_name from existing name if null and name exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'hr' AND table_name = 'technicians' AND column_name = 'name'
  ) THEN
    UPDATE hr.technicians 
    SET full_name = name 
    WHERE full_name IS NULL AND name IS NOT NULL;
  END IF;
END$$;

-- Add citext type for email if not already
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'citext') THEN
    CREATE EXTENSION IF NOT EXISTS citext;
  END IF;
END$$;

-- Update email column to citext if it's not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'hr' AND table_name = 'technicians' 
    AND column_name = 'email' AND data_type != 'USER-DEFINED'
  ) THEN
    ALTER TABLE hr.technicians ALTER COLUMN email TYPE citext;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tech_org ON hr.technicians(organization_id, is_active);

ALTER TABLE hr.technicians ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'hr' AND tablename = 'technicians' AND policyname = 'technicians_org_rls'
  ) THEN
    EXECUTE $$pol$
      CREATE POLICY technicians_org_rls ON hr.technicians
      USING (organization_id = current_setting('app.current_organization', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);
    $pol$$;
  END IF;
END$$;

------------------------------------------------------------
-- hr.work_order_evidence: photo evidence (update existing hr.evidence)
------------------------------------------------------------
-- Check if hr.evidence exists and create hr.work_order_evidence based on it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'hr' AND table_name = 'evidence'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'hr' AND table_name = 'work_order_evidence'
  ) THEN
    -- Create new table based on existing evidence structure
    CREATE TABLE hr.work_order_evidence (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      work_order_id uuid NOT NULL REFERENCES hr.work_orders(id) ON DELETE CASCADE,
      s3_key text NOT NULL,
      mime_type text NOT NULL,
      size_bytes integer NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    
    -- Migrate data if any exists
    INSERT INTO hr.work_order_evidence (organization_id, work_order_id, s3_key, mime_type, size_bytes, created_at)
    SELECT organization_id, work_order_id, file_key, mime, 0 as size_bytes, created_at
    FROM hr.evidence;
    
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'hr' AND table_name = 'work_order_evidence'
  ) THEN
    -- Create fresh table if evidence doesn't exist
    CREATE TABLE hr.work_order_evidence (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      work_order_id uuid NOT NULL REFERENCES hr.work_orders(id) ON DELETE CASCADE,
      s3_key text NOT NULL,
      mime_type text NOT NULL,
      size_bytes integer NOT NULL,
      created_at timestamptz DEFAULT now()
    );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_woe_org ON hr.work_order_evidence(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_woe_wo ON hr.work_order_evidence(work_order_id, created_at);

ALTER TABLE hr.work_order_evidence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'hr' AND tablename = 'work_order_evidence' AND policyname = 'woe_org_rls'
  ) THEN
    EXECUTE $$pol$
      CREATE POLICY woe_org_rls ON hr.work_order_evidence
      USING (organization_id = current_setting('app.current_organization', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);
    $pol$$;
  END IF;
END$$;

------------------------------------------------------------
-- Lightweight schema self-checks (safe selects)
------------------------------------------------------------
-- These SELECTs are harmless and help validate presence quickly in CI logs
SELECT 'work_orders_has_status' AS check, EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='hr' AND table_name='work_orders' AND column_name='status'
) AS ok;

SELECT 'tables_exist' AS check,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='hr' AND table_name='work_order_status_history') AS wosh,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='hr' AND table_name='technicians') AS tech,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='hr' AND table_name='work_order_evidence') AS evidence;