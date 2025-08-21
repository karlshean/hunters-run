CREATE TABLE IF NOT EXISTS hr.photo_upload_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  s3_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ NULL
);

ALTER TABLE hr.photo_upload_tokens ENABLE ROW LEVEL SECURITY;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'hr'
      AND tablename = 'photo_upload_tokens'
      AND policyname = 'photo_tokens_org_policy'
  ) THEN
    CREATE POLICY photo_tokens_org_policy
      ON hr.photo_upload_tokens
      USING (organization_id = current_setting('app.current_organization', true)::uuid);
  END IF;
END$;

CREATE INDEX IF NOT EXISTS idx_photo_tokens_expires ON hr.photo_upload_tokens(expires_at);