-- Migration 013: H5 Audit & Evidence Immutability - Audit Log
-- Creates hr.audit_log table with hash chain per (org_id, entity, entity_id)

BEGIN;

-- Create the immutable audit log table
CREATE TABLE IF NOT EXISTS hr.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,                -- e.g. "work_order.created"
  entity text NOT NULL,                -- e.g. "work_order" | "payment" | "role"
  entity_id text NOT NULL,             -- uuid or natural id, keep as text for flexibility
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  prev_hash bytea,
  hash bytea NOT NULL
);

-- Chain key & time ordering index
CREATE INDEX IF NOT EXISTS audit_log_chain_idx
ON hr.audit_log (org_id, entity, entity_id, created_at);

-- Performance index for verification queries
CREATE INDEX IF NOT EXISTS audit_log_org_entity_idx
ON hr.audit_log (org_id, entity, entity_id);

-- Time-based index for querying recent events
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
ON hr.audit_log (created_at);

-- RLS: per-org view only
ALTER TABLE hr.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_access ON hr.audit_log
  USING (org_id = current_setting('app.current_org')::uuid);

-- Grant appropriate permissions to api_role
GRANT SELECT, INSERT ON hr.audit_log TO api_role;

-- Nobody can UPDATE/DELETE - immutability enforcement
REVOKE UPDATE, DELETE ON hr.audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON hr.audit_log FROM api_role;

-- Ensure api_role cannot bypass RLS
ALTER TABLE hr.audit_log FORCE ROW LEVEL SECURITY;

COMMIT;