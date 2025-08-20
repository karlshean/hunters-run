-- Deterministic seed data for Supabase deployment
-- Fixed UUIDs for consistent demo data across environments
-- Uses UPSERTs for idempotent execution

BEGIN;

-- Insert organization first (required for RLS policies)
INSERT INTO hr.organizations (id, name, created_at)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Demo Property Management',
    '2024-01-01T00:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

-- Set organization context for RLS
SET LOCAL app.current_org = '00000000-0000-4000-8000-000000000001';

-- Seed Property
INSERT INTO hr.properties (id, organization_id, name, address, created_at)
VALUES (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001', 
    'Hunters Run Apartments',
    '456 Elm Street, Demo City, TX 75001',
    '2024-01-01T00:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address;

-- Seed Unit
INSERT INTO hr.units (id, organization_id, property_id, unit_number, created_at)
VALUES (
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Apt 2B',
    '2024-01-01T00:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  property_id = EXCLUDED.property_id,
  unit_number = EXCLUDED.unit_number;

-- Seed Tenant
INSERT INTO hr.tenants (id, organization_id, unit_id, name, phone, email, created_at)
VALUES (
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    'Sarah Johnson',
    '555-0198',
    'sarah.johnson@email.com',
    '2024-01-01T00:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  unit_id = EXCLUDED.unit_id,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email;

-- Seed Technician
INSERT INTO hr.technicians (id, organization_id, name, phone, email, created_at)
VALUES (
    '00000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    'Alex Rodriguez',
    '555-0287',
    'alex.rodriguez@maintenance.co',
    '2024-01-01T00:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email;

-- Seed Work Order 1 (High Priority - Plumbing Emergency)
INSERT INTO hr.work_orders (id, organization_id, unit_id, tenant_id, title, description, priority, status, assigned_tech_id, created_at, updated_at)
VALUES (
    '00000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    'Bathroom sink completely blocked',
    'Water backing up into bathroom sink. Cannot use sink at all. Emergency repair needed.',
    'high',
    'assigned',
    '00000000-0000-4000-8000-000000000005',
    '2024-01-10T08:15:00Z',
    '2024-01-10T10:30:00Z'
) ON CONFLICT (id) DO UPDATE SET
  unit_id = EXCLUDED.unit_id,
  tenant_id = EXCLUDED.tenant_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  assigned_tech_id = EXCLUDED.assigned_tech_id,
  updated_at = EXCLUDED.updated_at;

-- Seed Work Order 2 (Normal Priority - Maintenance)
INSERT INTO hr.work_orders (id, organization_id, unit_id, tenant_id, title, description, priority, status, assigned_tech_id, created_at, updated_at)
VALUES (
    '00000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    'Kitchen cabinet door loose',
    'Upper kitchen cabinet door is coming loose from hinges. Not urgent but should be fixed.',
    'normal',
    'new',
    NULL,
    '2024-01-12T16:45:00Z',
    '2024-01-12T16:45:00Z'
) ON CONFLICT (id) DO UPDATE SET
  unit_id = EXCLUDED.unit_id,
  tenant_id = EXCLUDED.tenant_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  assigned_tech_id = EXCLUDED.assigned_tech_id,
  updated_at = EXCLUDED.updated_at;

-- Seed Work Order 3 (Low Priority - Cosmetic)
INSERT INTO hr.work_orders (id, organization_id, unit_id, tenant_id, title, description, priority, status, assigned_tech_id, created_at, updated_at)
VALUES (
    '00000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    'Touch up paint in hallway',
    'Small scuff marks on hallway wall need touch-up paint. Cosmetic issue only.',
    'low',
    'completed',
    '00000000-0000-4000-8000-000000000005',
    '2024-01-05T11:20:00Z',
    '2024-01-08T14:15:00Z'
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

-- Create audit events for seeded work orders to demonstrate audit trail
SELECT hr.create_audit_event(
    '00000000-0000-4000-8000-000000000001'::uuid,
    'create',
    'work_order',
    '00000000-0000-4000-8000-000000000006'::uuid,
    '{"title": "Bathroom sink completely blocked", "priority": "high", "status": "assigned"}'::jsonb
);

SELECT hr.create_audit_event(
    '00000000-0000-4000-8000-000000000001'::uuid,
    'create',
    'work_order',
    '00000000-0000-4000-8000-000000000007'::uuid,
    '{"title": "Kitchen cabinet door loose", "priority": "normal", "status": "new"}'::jsonb
);

SELECT hr.create_audit_event(
    '00000000-0000-4000-8000-000000000001'::uuid,
    'create',
    'work_order',
    '00000000-0000-4000-8000-000000000008'::uuid,
    '{"title": "Touch up paint in hallway", "priority": "low", "status": "completed"}'::jsonb
);

-- Simulate status update audit trail for work order 6 (assigned)
SELECT hr.create_audit_event(
    '00000000-0000-4000-8000-000000000001'::uuid,
    'update',
    'work_order',
    '00000000-0000-4000-8000-000000000006'::uuid,
    '{"status": "assigned", "assigned_tech_id": "00000000-0000-4000-8000-000000000005", "previous_status": "new"}'::jsonb
);

-- Simulate completion audit trail for work order 8
SELECT hr.create_audit_event(
    '00000000-0000-4000-8000-000000000001'::uuid,
    'update',
    'work_order',
    '00000000-0000-4000-8000-000000000008'::uuid,
    '{"status": "completed", "previous_status": "assigned", "completion_notes": "Paint touch-up completed successfully"}'::jsonb
);