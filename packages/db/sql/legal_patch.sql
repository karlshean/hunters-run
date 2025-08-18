-- legal_patch.sql
-- Core legal tables + RLS
create table if not exists hr.notice_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  name text not null,
  description text,
  body_template text not null,
  created_at timestamptz not null default now()
);

create table if not exists hr.legal_notices (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  tenant_id uuid not null,
  template_id uuid not null references hr.notice_templates(id),
  status text not null default 'draft', -- draft|issued|served|filed|void
  variables jsonb not null default '{}',
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hr.service_attempts (
  id bigserial primary key,
  organization_id uuid not null,
  notice_id uuid not null references hr.legal_notices(id) on delete cascade,
  attempt_time timestamptz not null default now(),
  server_name text,
  method text, -- personal|substitute|posting|mail
  success boolean default false,
  notes text
);

-- Webhooks + disputes + sms status
create table if not exists hr.webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  organization_id uuid null,
  primary key (provider, event_id)
);

create table if not exists hr.payment_disputes (
  stripe_dispute_id text primary key,
  organization_id uuid not null,
  charge_id text,
  reason text,
  amount_cents int,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists hr.sms_messages (
  id bigserial primary key,
  organization_id uuid not null,
  to_number text not null,
  from_number text not null,
  body text,
  provider_id text,
  status text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_legal_notices_tenant on hr.legal_notices(tenant_id, status, created_at);
create index if not exists idx_service_attempts_notice on hr.service_attempts(notice_id, attempt_time);
create index if not exists idx_events_org_time on hr.events(organization_id, created_at);

-- Enable RLS + policies
alter table hr.notice_templates enable row level security;
alter table hr.legal_notices enable row level security;
alter table hr.service_attempts enable row level security;
alter table hr.webhook_events enable row level security;
alter table hr.payment_disputes enable row level security;
alter table hr.sms_messages enable row level security;
alter table hr.events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='notice_templates') then
    create policy p_nt on hr.notice_templates using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='legal_notices') then
    create policy p_ln on hr.legal_notices using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='service_attempts') then
    create policy p_sa on hr.service_attempts using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='webhook_events') then
    create policy p_we on hr.webhook_events using (organization_id is null or organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='payment_disputes') then
    create policy p_pd on hr.payment_disputes using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='sms_messages') then
    create policy p_sms on hr.sms_messages using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hr' and tablename='events') then
    create policy p_ev on hr.events using (organization_id = current_setting('app.current_org', true)::uuid);
  end if;
end$$;