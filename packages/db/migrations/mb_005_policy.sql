-- Donna MB Policy Layer
-- Policy events table for tracking Donna's learning and decisions

-- Policy provenance (why Donna decided X)
create table if not exists mb.policy_events (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('manager','person','commitment')),
  subject_id uuid not null,
  key text not null,   -- e.g., "proof_mode", "tone", "enable_department"
  value jsonb not null, -- {"new":"require","old":"encourage","reason":"3 no-proof completions","confidence":0.84}
  created_at timestamptz not null default now()
);

create index if not exists idx_policy_events_subject on mb.policy_events(subject_type, subject_id, created_at desc);
create index if not exists idx_policy_events_key on mb.policy_events(key, created_at desc);

-- Add learned_prefs columns if not already present (idempotent)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'mb' and table_name = 'managers' and column_name = 'learned_prefs'
  ) then
    alter table mb.managers add column learned_prefs jsonb not null default '{}'::jsonb;
  end if;
  
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'mb' and table_name = 'people' and column_name = 'learned_prefs'  
  ) then
    alter table mb.people add column learned_prefs jsonb not null default '{}'::jsonb;
  end if;
end
$$;