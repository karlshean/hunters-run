-- Migration: 015_photo_fields.sql
-- Add photo fields to work_orders and create photo upload tokens table

-- Add photo fields to work_orders table
ALTER TABLE hr.work_orders
  ADD COLUMN IF NOT EXISTS tenant_photo_url text,
  ADD COLUMN IF NOT EXISTS tenant_photo_s3_key text,
  ADD COLUMN IF NOT EXISTS tenant_photo_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS tenant_photo_size_bytes integer,
  ADD COLUMN IF NOT EXISTS tenant_photo_mime_type text,
  ADD COLUMN IF NOT EXISTS tenant_photo_etag text;

-- Create photo upload tokens table for presigned URL management
CREATE TABLE IF NOT EXISTS hr.photo_upload_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  s3_key text not null,
  expires_at timestamptz not null
);

-- Enable RLS for photo upload tokens
ALTER TABLE hr.photo_upload_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for photo upload tokens
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'photo_upload_tokens' 
    AND policyname = 'photo_tokens_rls'
  ) THEN
    CREATE POLICY photo_tokens_rls ON hr.photo_upload_tokens
      USING (organization_id = current_setting('app.current_org')::uuid);
  END IF;
END $$;

-- Add index for efficient lookups on photo tokens
CREATE INDEX IF NOT EXISTS idx_photo_upload_tokens_s3_key 
  ON hr.photo_upload_tokens(s3_key);
CREATE INDEX IF NOT EXISTS idx_photo_upload_tokens_expires_at 
  ON hr.photo_upload_tokens(expires_at);