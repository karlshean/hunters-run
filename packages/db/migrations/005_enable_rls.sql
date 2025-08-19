-- Migration 005: Enable Row Level Security (RLS)
-- Enables RLS on all tables and creates organization-based policies

BEGIN;

-- Enable RLS on all tables
ALTER TABLE hr.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.events ENABLE ROW LEVEL SECURITY;

-- Create organization access policies for each table
CREATE POLICY org_access ON hr.properties
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY org_access ON hr.units
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY org_access ON hr.tenants
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY org_access ON hr.technicians
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY org_access ON hr.work_orders
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY org_access ON hr.evidence
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY org_access ON hr.events
  USING (organization_id = current_setting('app.current_org')::uuid);

COMMIT;