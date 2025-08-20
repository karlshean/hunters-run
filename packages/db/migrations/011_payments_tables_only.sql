-- Create payments tables (schema exists, just add tables)

BEGIN;

-- Core payments tables
CREATE TABLE IF NOT EXISTS payments.charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hr.organizations(id),
    tenant_id UUID NOT NULL REFERENCES hr.tenants(id),
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hr.organizations(id),
    tenant_id UUID NOT NULL REFERENCES hr.tenants(id),
    provider TEXT NOT NULL DEFAULT 'stripe',
    provider_payment_id TEXT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    received_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments.allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hr.organizations(id),
    payment_id UUID NOT NULL REFERENCES payments.payments(id) ON DELETE CASCADE,
    charge_id UUID NOT NULL REFERENCES payments.charges(id) ON DELETE RESTRICT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (payment_id, charge_id)
);

CREATE TABLE IF NOT EXISTS payments.webhook_events (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES hr.organizations(id),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    type TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw JSONB NOT NULL,
    UNIQUE (provider, event_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_charges_org_due ON payments.charges(organization_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_payments_org_time ON payments.payments(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_alloc_org_pay ON payments.allocations(organization_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_provider_event ON payments.webhook_events(provider, event_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments.payments(provider_payment_id);

-- Enable RLS
ALTER TABLE payments.charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY org_access ON payments.charges 
    FOR ALL TO api_role
    USING (organization_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_access ON payments.payments 
    FOR ALL TO api_role
    USING (organization_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_access ON payments.allocations 
    FOR ALL TO api_role
    USING (organization_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_access ON payments.webhook_events 
    FOR ALL TO api_role
    USING (organization_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- Grant permissions
GRANT USAGE ON SCHEMA payments TO api_role;
GRANT ALL ON ALL TABLES IN SCHEMA payments TO api_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA payments TO api_role;

COMMIT;