-- Migration: Add name column to existing hr.units table and update indexes
-- Date: 2025-08-21

-- Add name column to existing hr.units table (fallback to unit_number if needed)
DO $$
BEGIN
    -- Add name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'hr' AND table_name = 'units' AND column_name = 'name') THEN
        ALTER TABLE hr.units ADD COLUMN name text;
        
        -- Populate name column with unit_number values for existing records
        UPDATE hr.units SET name = unit_number WHERE name IS NULL;
        
        -- Make name column NOT NULL after populating
        ALTER TABLE hr.units ALTER COLUMN name SET NOT NULL;
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'hr' AND table_name = 'units' AND column_name = 'updated_at') THEN
        ALTER TABLE hr.units ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END$$;

-- Enable RLS on hr.units (if not already enabled)
ALTER TABLE hr.units ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for organization isolation (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS units_org_rls_new ON hr.units;
CREATE POLICY units_org_rls_new ON hr.units
    USING (organization_id = current_setting('app.current_org', true)::uuid);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_units_org_name ON hr.units(organization_id, name);