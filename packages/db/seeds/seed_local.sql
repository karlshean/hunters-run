-- Deterministic seed data for local development
-- Fixed UUID: 00000000-0000-0000-0000-000000000001
-- Uses UPSERTs for idempotent execution

BEGIN;

-- Set organization context
SET LOCAL app.current_org = '00000000-0000-0000-0000-000000000001';

-- Seed Property
INSERT INTO hr.properties (id, organization_id, name, address, created_at)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001', 
    'Sunset Apartments',
    '123 Main Street, Anytown, CA 90210',
    '2024-01-01T00:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address;

-- Seed Unit
INSERT INTO hr.units (id, organization_id, property_id, unit_number, created_at)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Unit 101',
    '2024-01-01T00:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  property_id = EXCLUDED.property_id,
  unit_number = EXCLUDED.unit_number;

-- Seed Tenant
INSERT INTO hr.tenants (id, organization_id, unit_id, name, phone, email, created_at)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'John Doe',
    '555-0123',
    'john.doe@example.com',
    '2024-01-01T00:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  unit_id = EXCLUDED.unit_id,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email;

-- Seed Technician
INSERT INTO hr.technicians (id, organization_id, name, phone, email, created_at)
VALUES (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Mike Wilson',
    '555-0456',
    'mike.wilson@maintenance.com',
    '2024-01-01T00:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email;

-- Seed Work Order 1 (High Priority)
INSERT INTO hr.work_orders (id, organization_id, unit_id, tenant_id, title, description, priority, status, assigned_tech_id, created_at, updated_at)
VALUES (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Leaking kitchen faucet',
    'Water is dripping continuously from the kitchen faucet. Needs immediate attention.',
    'high',
    'new',
    NULL,
    '2024-01-02T09:00:00Z',
    '2024-01-02T09:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  unit_id = EXCLUDED.unit_id,
  tenant_id = EXCLUDED.tenant_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  assigned_tech_id = EXCLUDED.assigned_tech_id,
  updated_at = EXCLUDED.updated_at;

-- Seed Work Order 2 (Normal Priority)
INSERT INTO hr.work_orders (id, organization_id, unit_id, tenant_id, title, description, priority, status, assigned_tech_id, created_at, updated_at)
VALUES (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Replace air filter',
    'HVAC air filter needs replacement. Scheduled maintenance.',
    'normal',
    'new',
    NULL,
    '2024-01-03T14:30:00Z',
    '2024-01-03T14:30:00Z'
) ON CONFLICT (id) DO UPDATE SET
  unit_id = EXCLUDED.unit_id,
  tenant_id = EXCLUDED.tenant_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  assigned_tech_id = EXCLUDED.assigned_tech_id,
  updated_at = EXCLUDED.updated_at;

COMMIT;

-- Create audit events for the seeded work orders
SELECT hr.create_audit_event(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'create',
    'work_order',
    '50000000-0000-0000-0000-000000000001'::uuid,
    '{"title": "Leaking kitchen faucet", "priority": "high", "status": "new"}'::jsonb
);

SELECT hr.create_audit_event(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'create',
    'work_order',
    '50000000-0000-0000-0000-000000000002'::uuid,
    '{"title": "Replace air filter", "priority": "normal", "status": "new"}'::jsonb
);