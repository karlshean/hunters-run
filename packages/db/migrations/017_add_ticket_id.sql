-- Migration: 017_add_ticket_id.sql
-- Add ticket_id field to work_orders table for human-readable identifiers

-- Add ticket_id column if it doesn't exist
ALTER TABLE hr.work_orders 
  ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(20);

-- Create index for ticket_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_ticket_id 
  ON hr.work_orders(ticket_id);

-- Create unique constraint on ticket_id within organization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_orders_ticket_id_org_unique'
  ) THEN
    ALTER TABLE hr.work_orders 
      ADD CONSTRAINT work_orders_ticket_id_org_unique 
      UNIQUE (organization_id, ticket_id);
  END IF;
END $$;