-- base.sql
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create schema if not exists platform;
create schema if not exists hr;

-- audit events
create table if not exists hr.events (
  id bigserial primary key,
  organization_id uuid not null,
  actor_uid text,
  event_type text not null,
  subject_type text,
  subject_id bigint,
  payload jsonb,
  prev_hash bytea,
  current_hash bytea not null,
  created_at timestamptz not null default now()
);

create or replace function hr.event_compute_hash(
  prev bytea,
  org uuid,
  actor text,
  etype text,
  stype text,
  sid bigint,
  p jsonb,
  ts timestamptz
) returns bytea as $$
  select digest(
    coalesce(encode(prev,'hex'),'') || coalesce(org::text,'') ||
    coalesce(actor,'') || coalesce(etype,'') ||
    coalesce(stype,'') || coalesce(sid::text,'') ||
    coalesce(p::text,'') || coalesce(ts::text,''),
    'sha256'
  );
$$ language sql immutable;

create or replace function hr.update_event_hash()
returns trigger as $$
declare ph bytea;
begin
  select current_hash into ph
  from hr.events
  where organization_id = new.organization_id
    and id < new.id
  order by id desc limit 1;

  new.prev_hash := coalesce(ph, E'\\x00');
  new.current_hash := hr.event_compute_hash(new.prev_hash, new.organization_id, new.actor_uid,
                                           new.event_type, new.subject_type, new.subject_id,
                                           new.payload, new.created_at);
  return new;
end
$$ language plpgsql;

drop trigger if exists trg_update_event_hash on hr.events;
create trigger trg_update_event_hash
before insert on hr.events
for each row execute function hr.update_event_hash();