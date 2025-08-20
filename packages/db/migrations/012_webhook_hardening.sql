-- Webhook hardening: events deduplication and dead letter pattern

BEGIN;

-- Drop existing webhook_events table and recreate with proper schema
DROP TABLE IF EXISTS payments.webhook_events CASCADE;

CREATE TABLE payments.webhook_events (
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL,
    PRIMARY KEY (provider, event_id)
);

-- Create webhook failures table for dead letter pattern
CREATE TABLE IF NOT EXISTS payments.webhook_failures (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, event_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON payments.webhook_events(received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_provider_event ON payments.webhook_failures(provider, event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_retry ON payments.webhook_failures(retry_count, last_retry_at);

-- Enable RLS
ALTER TABLE payments.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.webhook_failures ENABLE ROW LEVEL SECURITY;

-- RLS policies - webhook events are global (no org filtering needed for external webhooks)
CREATE POLICY webhook_events_all ON payments.webhook_events 
    FOR ALL TO api_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY webhook_failures_all ON payments.webhook_failures 
    FOR ALL TO api_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON payments.webhook_events TO api_role;
GRANT ALL ON payments.webhook_failures TO api_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA payments TO api_role;

COMMIT;