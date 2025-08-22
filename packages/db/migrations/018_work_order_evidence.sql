-- Migration: Work Order Evidence Table
-- Creates table for storing photo evidence attached to work orders

CREATE TABLE IF NOT EXISTS hr.work_order_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES hr.work_orders(id),
  organization_id uuid NOT NULL,
  s3_key text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_work_order ON hr.work_order_evidence(work_order_id);
CREATE INDEX IF NOT EXISTS idx_evidence_org ON hr.work_order_evidence(organization_id);

ALTER TABLE hr.work_order_evidence ENABLE ROW LEVEL SECURITY;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='hr' AND tablename='work_order_evidence' AND policyname='evidence_rls'
  ) THEN
    -- Use current_org setting to match existing RLS pattern in the codebase
    CREATE POLICY evidence_rls ON hr.work_order_evidence
      USING (organization_id = current_setting('app.current_org', true)::uuid);
  END IF;
END$;