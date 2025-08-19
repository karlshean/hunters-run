-- Migration: Demo seed data with idempotent inserts
-- This creates a complete demo environment with fixed UUIDs

-- Demo organization (Hunters Run Management)
INSERT INTO hr.organizations (id, name, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Hunters Run Management',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- Demo property (Hunters Run Apartments)
INSERT INTO hr.properties (id, organization_id, name, address, created_at, updated_at)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Hunters Run Apartments',
    '123 Hunters Run Drive, City, State 12345',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    updated_at = NOW();

-- Demo unit (Apartment 101)
INSERT INTO hr.units (id, organization_id, property_id, unit_number, unit_type, status, created_at, updated_at)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '101',
    '2BR/1BA',
    'occupied',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    unit_number = EXCLUDED.unit_number,
    unit_type = EXCLUDED.unit_type,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Demo tenant (John Smith)
INSERT INTO hr.tenants (id, organization_id, unit_id, first_name, last_name, email, phone, lease_start, lease_end, status, created_at, updated_at)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'John',
    'Smith',
    'john.smith@email.com',
    '+1-555-0123',
    '2024-01-01',
    '2024-12-31',
    'active',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    lease_start = EXCLUDED.lease_start,
    lease_end = EXCLUDED.lease_end,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Demo technician (Mike Wilson)
INSERT INTO hr.technicians (id, organization_id, first_name, last_name, email, phone, specialties, status, created_at, updated_at)
VALUES (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Mike',
    'Wilson',
    'mike.wilson@huntersrun.com',
    '+1-555-0456',
    ARRAY['plumbing', 'electrical', 'hvac'],
    'active',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    specialties = EXCLUDED.specialties,
    status = EXCLUDED.status,
    updated_at = NOW();