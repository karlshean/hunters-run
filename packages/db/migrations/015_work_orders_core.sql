-- Migration: Add core fields to existing work_orders table with collision-safe ticket IDs
-- Date: 2025-08-21

-- Add missing columns to existing table (idempotent)
DO $$
BEGIN
    -- Add tenant_photo_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'hr' AND table_name = 'work_orders' 
                  AND column_name = 'tenant_photo_url') THEN
        ALTER TABLE hr.work_orders ADD COLUMN tenant_photo_url text NULL;
    END IF;
    
    -- Add tenant_photo_uploaded_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'hr' AND table_name = 'work_orders' 
                  AND column_name = 'tenant_photo_uploaded_at') THEN
        ALTER TABLE hr.work_orders ADD COLUMN tenant_photo_uploaded_at timestamptz NULL;
    END IF;
    
    -- Add ticket_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'hr' AND table_name = 'work_orders' 
                  AND column_name = 'ticket_id') THEN
        ALTER TABLE hr.work_orders ADD COLUMN ticket_id text UNIQUE;
    END IF;
END$$;

-- Basic constraints / indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_org ON hr.work_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_unit ON hr.work_orders(unit_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON hr.work_orders(status);

-- Note: Status is already an enum type, no need for additional check constraint

-- Foreign key if hr.units exists (safe-guard)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='hr' AND table_name='units')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE table_schema='hr' AND table_name='work_orders'
                       AND constraint_type='FOREIGN KEY'
                       AND constraint_name='fk_work_orders_unit') THEN
        ALTER TABLE hr.work_orders
        ADD CONSTRAINT fk_work_orders_unit
        FOREIGN KEY (unit_id) REFERENCES hr.units(id) ON DELETE RESTRICT;
    END IF;
END$$;

-- RLS (org isolation) - assumes current_setting('app.current_organization')
ALTER TABLE hr.work_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='hr' AND tablename='work_orders'
                   AND policyname='work_orders_rls') THEN
        CREATE POLICY work_orders_rls ON hr.work_orders
            USING (organization_id = current_setting('app.current_organization', true)::uuid);
    END IF;
END$$;

-- Ticket sequence (single global seq; ticket_id is WO-YYYY-####)
CREATE SEQUENCE IF NOT EXISTS hr.work_order_seq;