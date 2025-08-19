-- Migration 007: Add performance indexes for work orders
-- Creates optimized indexes for common query patterns

BEGIN;

-- Work orders indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS idx_work_orders_org_status 
ON hr.work_orders (organization_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_work_orders_org_priority 
ON hr.work_orders (organization_id, priority, created_at);

-- Evidence indexes for work order relationships
CREATE INDEX IF NOT EXISTS idx_evidence_org_wo_created 
ON hr.evidence (organization_id, work_order_id, created_at);

-- Events indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_events_org_created 
ON hr.events (organization_id, created_at);

-- Additional composite index for work order lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_org_unit_status 
ON hr.work_orders (organization_id, unit_id, status);

COMMIT;