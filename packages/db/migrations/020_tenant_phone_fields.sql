-- 020_tenant_phone_fields.sql
-- Add tenant phone and name fields to work_orders table

-- Add tenant_name and tenant_phone columns to work_orders (idempotent)
ALTER TABLE hr.work_orders
  ADD COLUMN IF NOT EXISTS tenant_name text,
  ADD COLUMN IF NOT EXISTS tenant_phone text;

-- Index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_phone ON hr.work_orders(tenant_phone) 
  WHERE tenant_phone IS NOT NULL;

-- Also ensure we have the title column if it doesn't exist
ALTER TABLE hr.work_orders
  ADD COLUMN IF NOT EXISTS title text;

-- Update any existing titles from description if title is null
UPDATE hr.work_orders 
SET title = COALESCE(title, LEFT(description, 255))
WHERE title IS NULL AND description IS NOT NULL;

-- Self-check
SELECT 'tenant_fields_exist' AS check,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='hr' AND table_name='work_orders' AND column_name='tenant_name') AS tenant_name,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='hr' AND table_name='work_orders' AND column_name='tenant_phone') AS tenant_phone,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='hr' AND table_name='work_orders' AND column_name='title') AS title;