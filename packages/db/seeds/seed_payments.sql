-- Idempotent payments seed data

-- Demo charges for the existing tenant
INSERT INTO payments.charges (id, organization_id, tenant_id, description, amount_cents, currency, due_date, status, created_at, updated_at)
VALUES (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Monthly Rent - January 2024',
    120000, -- $1200.00 in cents
    'usd',
    CURRENT_DATE,
    'unpaid',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    amount_cents = EXCLUDED.amount_cents,
    due_date = EXCLUDED.due_date,
    status = EXCLUDED.status,
    updated_at = NOW();

INSERT INTO payments.charges (id, organization_id, tenant_id, description, amount_cents, currency, due_date, status, created_at, updated_at)
VALUES (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Late Fee - January 2024',
    5000, -- $50.00 in cents
    'usd',
    CURRENT_DATE,
    'unpaid',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    amount_cents = EXCLUDED.amount_cents,
    due_date = EXCLUDED.due_date,
    status = EXCLUDED.status,
    updated_at = NOW();