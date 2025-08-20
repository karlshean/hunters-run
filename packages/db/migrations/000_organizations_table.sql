-- Add missing organizations table required by payments schema

BEGIN;

-- Create organizations table
CREATE TABLE IF NOT EXISTS hr.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hr.organizations ENABLE ROW LEVEL SECURITY;

-- Create policy for organization access
CREATE POLICY org_access ON hr.organizations
    FOR ALL TO api_role
    USING (id::text = current_setting('app.organization_id', true));

-- Create api_role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_role') THEN
        CREATE ROLE api_role;
    END IF;
END
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA hr TO api_role;
GRANT USAGE ON SCHEMA payments TO api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hr TO api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA payments TO api_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hr TO api_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA payments TO api_role;

-- Insert demo organization
INSERT INTO hr.organizations (id, name, created_at, updated_at) VALUES 
    ('00000000-0000-4000-8000-000000000001', 'Demo Organization', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

COMMIT;