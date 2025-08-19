-- Migration: Add work order evidence table

CREATE TABLE hr.work_order_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hr.organizations(id),
    work_order_id UUID NOT NULL REFERENCES hr.work_orders(id),
    file_key VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    sha256_hash CHAR(64) NOT NULL, -- SHA-256 hash (hex)
    taken_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hr.work_order_evidence ENABLE ROW LEVEL SECURITY;

-- RLS policy for work order evidence
CREATE POLICY work_order_evidence_org_policy ON hr.work_order_evidence
    FOR ALL
    TO api_role
    USING (organization_id::text = current_setting('app.current_org_id', true))
    WITH CHECK (organization_id::text = current_setting('app.current_org_id', true));

-- Indexes
CREATE INDEX idx_work_order_evidence_org ON hr.work_order_evidence(organization_id);
CREATE INDEX idx_work_order_evidence_work_order ON hr.work_order_evidence(work_order_id);
CREATE INDEX idx_work_order_evidence_sha256 ON hr.work_order_evidence(sha256_hash);