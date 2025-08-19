-- Migration 008: Fix audit hash logic to match precision requirements
-- Hash chain per (organization_id, entity_type, entity_id) ordered by created_at, id

BEGIN;

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS trigger_compute_event_hash ON hr.events;
DROP FUNCTION IF EXISTS hr.compute_event_hash();

-- Recreate function with correct hash chain logic
CREATE OR REPLACE FUNCTION hr.compute_event_hash()
RETURNS TRIGGER AS $$
DECLARE
    prev_hash_val BYTEA;
    hash_input TEXT;
BEGIN
    -- Get the most recent hash for this (organization_id, entity_type, entity_id)
    SELECT current_hash INTO prev_hash_val
    FROM hr.events 
    WHERE organization_id = NEW.organization_id 
      AND entity_type = NEW.entity_type
      AND entity_id = NEW.entity_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    
    -- If no previous hash, use zero hash
    IF prev_hash_val IS NULL THEN
        prev_hash_val := '\x0000000000000000000000000000000000000000000000000000000000000000'::bytea;
    END IF;
    
    -- Set the previous hash
    NEW.prev_hash := prev_hash_val;
    
    -- Create hash input: prev_hash || organization_id || entity_type || entity_id || event_type || new_values || created_at
    hash_input := concat(
        encode(prev_hash_val, 'hex'),
        NEW.organization_id::text,
        NEW.entity_type,
        NEW.entity_id::text,
        NEW.event_type,
        COALESCE(NEW.new_values::text, ''),
        extract(epoch from NEW.created_at)::text
    );
    
    -- Compute current hash using SHA256
    NEW.current_hash := digest(hash_input, 'sha256');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_compute_event_hash
    BEFORE INSERT ON hr.events
    FOR EACH ROW
    EXECUTE FUNCTION hr.compute_event_hash();

-- Add function to validate audit chain
CREATE OR REPLACE FUNCTION hr.validate_audit_chain(
    p_organization_id UUID,
    p_entity_type VARCHAR(50),
    p_entity_id UUID
)
RETURNS TABLE(
    valid BOOLEAN,
    events_count INTEGER,
    head_hash TEXT
) AS $$
DECLARE
    event_record RECORD;
    prev_hash_val BYTEA := '\x0000000000000000000000000000000000000000000000000000000000000000'::bytea;
    computed_hash BYTEA;
    hash_input TEXT;
    event_count INTEGER := 0;
    chain_valid BOOLEAN := TRUE;
    final_hash TEXT := '';
BEGIN
    -- Process events in order
    FOR event_record IN 
        SELECT e.id, e.organization_id, e.entity_type, e.entity_id, e.event_type, 
               e.new_values, e.prev_hash, e.current_hash, e.created_at
        FROM hr.events e
        WHERE e.organization_id = p_organization_id 
          AND e.entity_type = p_entity_type
          AND e.entity_id = p_entity_id
        ORDER BY e.created_at, e.id
    LOOP
        event_count := event_count + 1;
        
        -- Check if prev_hash matches expected
        IF event_record.prev_hash != prev_hash_val THEN
            chain_valid := FALSE;
        END IF;
        
        -- Recompute hash
        hash_input := concat(
            encode(prev_hash_val, 'hex'),
            event_record.organization_id::text,
            event_record.entity_type,
            event_record.entity_id::text,
            event_record.event_type,
            COALESCE(event_record.new_values::text, ''),
            extract(epoch from event_record.created_at)::text
        );
        
        computed_hash := digest(hash_input, 'sha256');
        
        -- Check if computed hash matches stored hash
        IF computed_hash != event_record.current_hash THEN
            chain_valid := FALSE;
        END IF;
        
        -- Set for next iteration
        prev_hash_val := event_record.current_hash;
        final_hash := encode(event_record.current_hash, 'hex');
    END LOOP;
    
    RETURN QUERY SELECT chain_valid, event_count, final_hash;
END;
$$ LANGUAGE plpgsql;

COMMIT;