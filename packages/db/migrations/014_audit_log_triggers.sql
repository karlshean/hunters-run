-- Migration 014: H5 Audit Log Triggers
-- Compute prev_hash + hash automatically (per chain key)

BEGIN;

-- Function to compute hash chain for audit log entries
CREATE OR REPLACE FUNCTION hr._audit_chain_compute()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prev_hash bytea;
  v_payload   jsonb;
BEGIN
  -- Get the last hash for same (org_id, entity, entity_id) chain
  SELECT hash INTO v_prev_hash
  FROM hr.audit_log
  WHERE org_id = NEW.org_id
    AND entity = NEW.entity
    AND entity_id = NEW.entity_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- Set previous hash (NULL if this is the first entry in the chain)
  NEW.prev_hash := v_prev_hash;

  -- Create deterministic payload for hashing
  v_payload := jsonb_build_object(
    'org_id', NEW.org_id::text,
    'actor_id', NEW.actor_id::text,
    'action', NEW.action,
    'entity', NEW.entity,
    'entity_id', NEW.entity_id,
    'metadata', COALESCE(NEW.metadata,'{}'::jsonb),
    'created_at', NEW.created_at::text
  );

  -- Compute hash: SHA256(prev_hash_hex:payload)
  NEW.hash := digest(
      coalesce(encode(NEW.prev_hash,'hex'),'') || ':' || v_payload::text,
      'sha256'
  );
  
  RETURN NEW;
END $$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_audit_chain_compute ON hr.audit_log;

-- Create trigger to compute hash chain before insert
CREATE TRIGGER trg_audit_chain_compute
BEFORE INSERT ON hr.audit_log
FOR EACH ROW EXECUTE FUNCTION hr._audit_chain_compute();

-- Helper function to create audit log entries
CREATE OR REPLACE FUNCTION hr.create_audit_log_entry(
    p_org_id uuid,
    p_action text,
    p_entity text,
    p_entity_id text,
    p_actor_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
    entry_id uuid;
BEGIN
    INSERT INTO hr.audit_log (org_id, action, entity, entity_id, actor_id, metadata)
    VALUES (p_org_id, p_action, p_entity, p_entity_id, p_actor_id, p_metadata)
    RETURNING id INTO entry_id;
    
    RETURN entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to use the helper function
GRANT EXECUTE ON FUNCTION hr.create_audit_log_entry TO api_role;

COMMIT;