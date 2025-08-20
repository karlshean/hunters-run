-- Migration: 016_photo_rollback_safety.sql
-- Create archive table and safety mechanisms for photo feature rollback
-- This ensures no photo evidence is lost during rollbacks

-- Create archive table for photo data (idempotent)
CREATE TABLE IF NOT EXISTS hr.work_order_photos_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  -- Original photo fields from work_orders table
  tenant_photo_url text,
  tenant_photo_s3_key text,
  tenant_photo_uploaded_at timestamptz,
  tenant_photo_size_bytes integer,
  tenant_photo_mime_type text,
  tenant_photo_etag text,
  -- Archive metadata
  archived_at timestamptz NOT NULL DEFAULT NOW(),
  archived_reason text NOT NULL DEFAULT 'rollback_safety',
  source_table text NOT NULL DEFAULT 'work_orders',
  -- Constraints
  CONSTRAINT work_order_photos_archive_org_fk 
    FOREIGN KEY (organization_id) REFERENCES hr.organizations(id),
  CONSTRAINT work_order_photos_archive_work_order_fk 
    FOREIGN KEY (work_order_id) REFERENCES hr.work_orders(id)
);

-- Enable RLS for archive table
ALTER TABLE hr.work_order_photos_archive ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for archive table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_order_photos_archive' 
    AND policyname = 'work_order_photos_archive_rls'
  ) THEN
    CREATE POLICY work_order_photos_archive_rls ON hr.work_order_photos_archive
      USING (organization_id = current_setting('app.current_org')::uuid);
  END IF;
END $$;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_work_order_photos_archive_work_order_id 
  ON hr.work_order_photos_archive(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_photos_archive_org_id 
  ON hr.work_order_photos_archive(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_order_photos_archive_archived_at 
  ON hr.work_order_photos_archive(archived_at);

-- Function to copy existing photo data to archive (idempotent)
CREATE OR REPLACE FUNCTION hr.snapshot_work_order_photos()
RETURNS TABLE(
  copied_count integer,
  skipped_count integer,
  total_processed integer
) AS $$
DECLARE
  _copied_count integer := 0;
  _skipped_count integer := 0;
  _total_processed integer := 0;
BEGIN
  -- Copy all work orders with photo data that aren't already archived
  INSERT INTO hr.work_order_photos_archive (
    work_order_id,
    organization_id,
    tenant_photo_url,
    tenant_photo_s3_key,
    tenant_photo_uploaded_at,
    tenant_photo_size_bytes,
    tenant_photo_mime_type,
    tenant_photo_etag,
    archived_reason
  )
  SELECT 
    wo.id,
    wo.organization_id,
    wo.tenant_photo_url,
    wo.tenant_photo_s3_key,
    wo.tenant_photo_uploaded_at,
    wo.tenant_photo_size_bytes,
    wo.tenant_photo_mime_type,
    wo.tenant_photo_etag,
    'migration_snapshot'
  FROM hr.work_orders wo
  WHERE (
    wo.tenant_photo_url IS NOT NULL 
    OR wo.tenant_photo_s3_key IS NOT NULL
    OR wo.tenant_photo_uploaded_at IS NOT NULL
    OR wo.tenant_photo_size_bytes IS NOT NULL
    OR wo.tenant_photo_mime_type IS NOT NULL
    OR wo.tenant_photo_etag IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM hr.work_order_photos_archive wopa
    WHERE wopa.work_order_id = wo.id 
    AND wopa.archived_reason = 'migration_snapshot'
  );

  GET DIAGNOSTICS _copied_count = ROW_COUNT;

  -- Count how many work orders have photos
  SELECT COUNT(*) INTO _total_processed
  FROM hr.work_orders wo
  WHERE (
    wo.tenant_photo_url IS NOT NULL 
    OR wo.tenant_photo_s3_key IS NOT NULL
    OR wo.tenant_photo_uploaded_at IS NOT NULL
    OR wo.tenant_photo_size_bytes IS NOT NULL
    OR wo.tenant_photo_mime_type IS NOT NULL
    OR wo.tenant_photo_etag IS NOT NULL
  );

  _skipped_count := _total_processed - _copied_count;

  RETURN QUERY SELECT _copied_count, _skipped_count, _total_processed;
END;
$$ LANGUAGE plpgsql;

-- Function to check if photo flow is enabled via environment variable
CREATE OR REPLACE FUNCTION hr.is_tenant_photo_flow_enabled()
RETURNS boolean AS $$
BEGIN
  -- Check if TENANT_PHOTO_FLOW_ENABLED environment variable is set to 'false'
  -- Default to true if not set (fail-safe)
  RETURN COALESCE(
    current_setting('app.tenant_photo_flow_enabled', true)::boolean,
    true
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, default to enabled for safety
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to prevent photo changes when feature is disabled
CREATE OR REPLACE FUNCTION hr.prevent_photo_changes_when_disabled()
RETURNS trigger AS $$
BEGIN
  -- Only check if we're updating photo fields
  IF (
    OLD.tenant_photo_url IS DISTINCT FROM NEW.tenant_photo_url OR
    OLD.tenant_photo_s3_key IS DISTINCT FROM NEW.tenant_photo_s3_key OR
    OLD.tenant_photo_uploaded_at IS DISTINCT FROM NEW.tenant_photo_uploaded_at OR
    OLD.tenant_photo_size_bytes IS DISTINCT FROM NEW.tenant_photo_size_bytes OR
    OLD.tenant_photo_mime_type IS DISTINCT FROM NEW.tenant_photo_mime_type OR
    OLD.tenant_photo_etag IS DISTINCT FROM NEW.tenant_photo_etag
  ) THEN
    -- Check if photo flow is disabled
    IF NOT hr.is_tenant_photo_flow_enabled() THEN
      RAISE EXCEPTION 'Photo field updates are disabled. TENANT_PHOTO_FLOW_ENABLED=false. Enable the feature or use archive table for data recovery.'
        USING ERRCODE = 'check_violation',
              HINT = 'Set TENANT_PHOTO_FLOW_ENABLED=true to enable photo updates, or query hr.work_order_photos_archive for historical data.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'prevent_photo_changes_when_disabled_trigger'
  ) THEN
    CREATE TRIGGER prevent_photo_changes_when_disabled_trigger
      BEFORE UPDATE ON hr.work_orders
      FOR EACH ROW
      EXECUTE FUNCTION hr.prevent_photo_changes_when_disabled();
  END IF;
END $$;

-- Function to restore photos from archive (for rollback scenarios)
CREATE OR REPLACE FUNCTION hr.restore_photos_from_archive(
  target_work_order_id uuid DEFAULT NULL,
  archived_since timestamptz DEFAULT NULL
)
RETURNS TABLE(
  restored_count integer,
  work_order_id uuid
) AS $$
DECLARE
  _restored_count integer := 0;
BEGIN
  -- Restore photos from archive to work_orders table
  -- Can target specific work order or restore all since a certain date
  WITH restored AS (
    UPDATE hr.work_orders wo
    SET 
      tenant_photo_url = wopa.tenant_photo_url,
      tenant_photo_s3_key = wopa.tenant_photo_s3_key,
      tenant_photo_uploaded_at = wopa.tenant_photo_uploaded_at,
      tenant_photo_size_bytes = wopa.tenant_photo_size_bytes,
      tenant_photo_mime_type = wopa.tenant_photo_mime_type,
      tenant_photo_etag = wopa.tenant_photo_etag
    FROM hr.work_order_photos_archive wopa
    WHERE wo.id = wopa.work_order_id
      AND (target_work_order_id IS NULL OR wo.id = target_work_order_id)
      AND (archived_since IS NULL OR wopa.archived_at >= archived_since)
    RETURNING wo.id
  )
  SELECT COUNT(*), wo_id FROM (
    SELECT id as wo_id FROM restored
  ) restored_summary
  GROUP BY wo_id;

  GET DIAGNOSTICS _restored_count = ROW_COUNT;
  
  IF _restored_count = 0 THEN
    RETURN QUERY SELECT 0::integer, NULL::uuid;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT ON hr.work_order_photos_archive TO hr_api_role;
GRANT EXECUTE ON FUNCTION hr.snapshot_work_order_photos() TO hr_api_role;
GRANT EXECUTE ON FUNCTION hr.is_tenant_photo_flow_enabled() TO hr_api_role;
GRANT EXECUTE ON FUNCTION hr.restore_photos_from_archive(uuid, timestamptz) TO hr_api_role;

-- Create view for easy photo data access across both tables
CREATE OR REPLACE VIEW hr.work_orders_with_photo_history AS
SELECT 
  wo.id,
  wo.organization_id,
  wo.ticket_id,
  wo.title,
  wo.description,
  wo.status,
  wo.priority,
  wo.created_at,
  wo.updated_at,
  -- Current photo data
  wo.tenant_photo_url as current_photo_url,
  wo.tenant_photo_s3_key as current_photo_s3_key,
  wo.tenant_photo_uploaded_at as current_photo_uploaded_at,
  wo.tenant_photo_size_bytes as current_photo_size_bytes,
  wo.tenant_photo_mime_type as current_photo_mime_type,
  wo.tenant_photo_etag as current_photo_etag,
  -- Archive info
  CASE WHEN wopa.id IS NOT NULL THEN true ELSE false END as has_archived_photos,
  wopa.archived_at as photo_archived_at,
  wopa.archived_reason as photo_archive_reason
FROM hr.work_orders wo
LEFT JOIN hr.work_order_photos_archive wopa ON wo.id = wopa.work_order_id
WHERE wo.organization_id = current_setting('app.current_org')::uuid;

-- Grant access to the view
GRANT SELECT ON hr.work_orders_with_photo_history TO hr_api_role;