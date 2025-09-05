-- Donna MB Core Schema v1.3
-- Creates managers, people, commitments, checkins, evidence, escalations, events, outbox, templates, messages

create schema if not exists mb;

-- Managers (team/org leaders using Donna)
create table if not exists mb.managers (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Policy settings (internal state, not UI)
  tone_style text not null default 'neutral' check (tone_style in ('neutral', 'catholic', 'neutral_plus_catholic')),
  enable_middle_manager boolean not null default true,
  enable_chief_of_staff boolean not null default true,
  enable_life_coach boolean not null default true,
  enable_family_manager boolean not null default true,
  
  -- Donna's learned preferences (invisible policy)
  learned_prefs jsonb not null default '{}'::jsonb
);

-- People (team members being managed)
create table if not exists mb.people (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references mb.managers(id) on delete cascade,
  name text not null,
  timezone text not null default 'UTC',
  checkin_hour integer not null default 17 check (checkin_hour between 0 and 23),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Override settings
  tone_override text check (tone_override in ('neutral', 'catholic')),
  
  -- Donna's learned preferences per person
  learned_prefs jsonb not null default '{}'::jsonb,
  
  -- Trust metrics
  trust_score integer not null default 5 check (trust_score between 0 and 10),
  streak_days integer not null default 0
);

-- Commitments (things people commit to)
create table if not exists mb.commitments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references mb.people(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'completed', 'skipped', 'escalated')),
  proof_mode text not null default 'encourage' check (proof_mode in ('encourage', 'require')),
  
  -- Scheduling
  next_ping_at timestamptz,
  frequency text check (frequency in ('daily', 'weekly', 'monthly')),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  
  -- Department routing
  department text check (department in ('middle_manager', 'chief_of_staff', 'life_coach', 'family_manager'))
);

-- Check-ins (responses to Donna's pings)
create table if not exists mb.checkins (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references mb.commitments(id) on delete cascade,
  status text not null check (status in ('done', 'skipped', 'partial')),
  note text,
  created_at timestamptz not null default now()
);

-- Evidence (proof attached to commitments)
create table if not exists mb.evidence (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references mb.commitments(id) on delete cascade,
  type text not null check (type in ('photo', 'document', 'link', 'note')),
  content_url text,
  description text,
  created_at timestamptz not null default now()
);

-- Escalations (when commitments need manager attention)
create table if not exists mb.escalations (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references mb.commitments(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Events (audit log for important actions)
create table if not exists mb.events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  subject_type text not null check (subject_type in ('manager', 'person', 'commitment', 'checkin')),
  subject_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Outbox (reliable message delivery)
create table if not exists mb.outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null check (recipient_type in ('manager', 'person')),
  recipient_id uuid not null,
  telegram_chat_id bigint,
  content jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);

-- Templates (message templates for different contexts)
create table if not exists mb.templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('nudge', 'escalation', 'praise', 'habit', 'family', 'chief', 'digest_closing')),
  tone text not null check (tone in ('neutral', 'catholic')),
  template text not null,
  variables text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Public schema: Messages (Telegram idempotency)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  telegram_update_id bigint unique,
  telegram_message_id bigint,
  telegram_chat_id bigint not null,
  direction text not null check (direction in ('in', 'out')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_managers_telegram_user_id on mb.managers(telegram_user_id);
create index if not exists idx_people_manager_id on mb.people(manager_id);
create index if not exists idx_commitments_person_id on mb.commitments(person_id);
create index if not exists idx_commitments_status on mb.commitments(status);
create index if not exists idx_commitments_next_ping_at on mb.commitments(next_ping_at) where status = 'open';
create index if not exists idx_checkins_commitment_id on mb.checkins(commitment_id);
create index if not exists idx_evidence_commitment_id on mb.evidence(commitment_id);
create index if not exists idx_escalations_commitment_id on mb.escalations(commitment_id);
create index if not exists idx_events_subject on mb.events(subject_type, subject_id, created_at desc);
create index if not exists idx_outbox_status on mb.outbox(status, scheduled_for);
create index if not exists idx_templates_kind_tone on mb.templates(kind, tone);
create unique index if not exists idx_messages_telegram_update_id on public.messages(telegram_update_id);