-- Donna MB Functions
-- Scheduling utilities for commitment pings

-- Function: Compute next ping time for a commitment
create or replace function mb.compute_next_ping_at(
  person_tz text,
  person_hour integer,
  frequency text default 'daily'
) returns timestamptz as $$
declare
  base_time timestamptz;
  next_time timestamptz;
begin
  -- Start from current time in person's timezone
  base_time := now() at time zone 'UTC' at time zone person_tz;
  
  case frequency
    when 'daily' then
      -- Next occurrence at person's checkin hour
      next_time := date_trunc('day', base_time) + interval '1 day' + (person_hour || ' hours')::interval;
      -- If we're past today's hour, schedule for today
      if extract(hour from base_time) < person_hour then
        next_time := next_time - interval '1 day';
      end if;
      
    when 'weekly' then
      -- Next Monday at checkin hour
      next_time := date_trunc('week', base_time) + interval '1 week' + (person_hour || ' hours')::interval;
      
    when 'monthly' then
      -- First of next month at checkin hour
      next_time := date_trunc('month', base_time) + interval '1 month' + (person_hour || ' hours')::interval;
      
    else
      -- Default to daily
      next_time := date_trunc('day', base_time) + interval '1 day' + (person_hour || ' hours')::interval;
      if extract(hour from base_time) < person_hour then
        next_time := next_time - interval '1 day';
      end if;
  end case;
  
  -- Convert back to UTC
  return next_time at time zone person_tz at time zone 'UTC';
end;
$$ language plpgsql;

-- Function: Schedule next ping for a specific commitment
create or replace function mb.schedule_next_ping(commitment_uuid uuid)
returns void as $$
declare
  person_rec record;
  commitment_rec record;
  next_ping timestamptz;
begin
  -- Get commitment and person details
  select c.frequency, p.timezone, p.checkin_hour
  into commitment_rec
  from mb.commitments c
  join mb.people p on p.id = c.person_id
  where c.id = commitment_uuid;
  
  if not found then
    return;
  end if;
  
  -- Compute next ping time
  next_ping := mb.compute_next_ping_at(
    commitment_rec.timezone,
    commitment_rec.checkin_hour,
    coalesce(commitment_rec.frequency, 'daily')
  );
  
  -- Update commitment
  update mb.commitments
  set next_ping_at = next_ping,
      updated_at = now()
  where id = commitment_uuid;
end;
$$ language plpgsql;

-- Function: Reschedule all open commitments for a person (when tz/hour changes)
create or replace function mb.reschedule_person_commitments(person_uuid uuid)
returns void as $$
declare
  commitment_id uuid;
begin
  -- Loop through all open commitments for this person
  for commitment_id in
    select id from mb.commitments
    where person_id = person_uuid and status = 'open'
  loop
    perform mb.schedule_next_ping(commitment_id);
  end loop;
end;
$$ language plpgsql;