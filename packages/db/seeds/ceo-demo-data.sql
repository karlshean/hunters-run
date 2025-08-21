-- CEO Validation Demo Data - Fixed IDs for consistent testing
-- All IDs are static and idempotent (INSERT ... ON CONFLICT DO UPDATE)

BEGIN;

-- Fixed organization
INSERT INTO hr.organizations (id, name, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'Demo Organization', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Fixed property
INSERT INTO hr.properties (id, organization_id, name, address)
VALUES (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'Demo Property',
    '123 Main St'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Fixed unit
INSERT INTO hr.units (id, organization_id, property_id, unit_number)
VALUES (
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '101'
)
ON CONFLICT (id) DO UPDATE SET unit_number = EXCLUDED.unit_number;

-- Fixed tenant
INSERT INTO hr.tenants (id, organization_id, unit_id, name, email, phone)
VALUES (
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    'John Doe',
    'john@example.com',
    '555-0100'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Fixed technician
INSERT INTO hr.technicians (id, organization_id, name, email, phone)
VALUES (
    '00000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    'Tech Smith',
    'tech@example.com',
    '555-0200'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Fixed charge ($1200 rent due today)
INSERT INTO payments.charges (
    id,
    organization_id,
    tenant_id,
    description,
    amount_cents,
    currency,
    due_date,
    status,
    created_at,
    updated_at
)
VALUES (
    '00000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000004',
    'Monthly Rent',
    120000,  -- $1200.00
    'usd',
    CURRENT_DATE,
    'unpaid',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET 
    amount_cents = EXCLUDED.amount_cents,
    due_date = EXCLUDED.due_date,
    updated_at = NOW();

-- Add additional demo units for new hr.units table schema
DO $$
DECLARE 
    v_org uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
    INSERT INTO hr.units (id, organization_id, name)
    VALUES
        ('11111111-1111-1111-1111-111111111111', v_org, 'Unit 101'),
        ('22222222-2222-2222-2222-222222222222', v_org, 'Unit 202')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
END$$;

COMMIT;