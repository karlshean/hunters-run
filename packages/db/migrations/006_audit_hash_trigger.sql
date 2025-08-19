-- Migration 006: Audit hash chain trigger
-- Creates trigger function to compute hash chain for audit events

BEGIN;

-- Function to compute hash chain for audit events
CREATE OR REPLACE FUNCTION hr.compute_event_hash()
RETURNS TRIGGER AS $$
DECLARE
    prev_hash_val BYTEA;
    hash_input TEXT;
BEGIN
    -- Get the most recent hash for this organization
    SELECT current_hash INTO prev_hash_val
    FROM hr.events 
    WHERE organization_id = NEW.organization_id 
    ORDER BY id DESC 
    LIMIT 1;
    
    -- If no previous hash, use zero hash
    IF prev_hash_val IS NULL THEN
        prev_hash_val := '\x0000000000000000000000000000000000000000000000000000000000000000'::bytea;
    END IF;
    
    -- Set the previous hash
    NEW.prev_hash := prev_hash_val;
    
    -- Create hash input string
    hash_input := concat(
        encode(prev_hash_val, 'hex'),
        NEW.organization_id::text,
        NEW.event_type,
        NEW.entity_type,
        NEW.entity_id::text,
        COALESCE(NEW.new_values::text, ''),
        extract(epoch from NEW.created_at)::text
    );
    
    -- Compute current hash using SHA256
    NEW.current_hash := digest(hash_input, 'sha256');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on events table
CREATE TRIGGER trigger_compute_event_hash
    BEFORE INSERT ON hr.events
    FOR EACH ROW
    EXECUTE FUNCTION hr.compute_event_hash();

-- Function to create audit events
CREATE OR REPLACE FUNCTION hr.create_audit_event(
    p_organization_id UUID,
    p_event_type VARCHAR(50),
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_new_values JSONB DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    event_id BIGINT;
BEGIN
    INSERT INTO hr.events (organization_id, event_type, entity_type, entity_id, new_values)
    VALUES (p_organization_id, p_event_type, p_entity_type, p_entity_id, p_new_values)
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;