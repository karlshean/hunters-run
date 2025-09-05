-- Donna MB Triggers
-- Auto-reschedule commitments when person's timezone or checkin hour changes

-- Function: Handle person schedule changes
create or replace function mb.handle_person_schedule_change()
returns trigger as $$
begin
  -- Only reschedule if timezone or checkin_hour changed
  if (old.timezone is distinct from new.timezone) or 
     (old.checkin_hour is distinct from new.checkin_hour) then
    
    -- Reschedule all open commitments for this person
    perform mb.reschedule_person_commitments(new.id);
    
    -- Log the event
    insert into mb.events (type, subject_type, subject_id, metadata)
    values (
      'person_schedule_changed',
      'person', 
      new.id,
      jsonb_build_object(
        'old_timezone', old.timezone,
        'new_timezone', new.timezone,
        'old_checkin_hour', old.checkin_hour,
        'new_checkin_hour', new.checkin_hour
      )
    );
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Trigger: Auto-reschedule on person changes
drop trigger if exists trigger_person_schedule_change on mb.people;
create trigger trigger_person_schedule_change
  after update on mb.people
  for each row
  execute function mb.handle_person_schedule_change();

-- Function: Auto-schedule new commitments
create or replace function mb.handle_new_commitment()
returns trigger as $$
begin
  -- Schedule next ping for new open commitments
  if new.status = 'open' and new.next_ping_at is null then
    perform mb.schedule_next_ping(new.id);
    
    -- Log the event
    insert into mb.events (type, subject_type, subject_id, metadata)
    values (
      'commitment_created',
      'commitment',
      new.id,
      jsonb_build_object(
        'title', new.title,
        'person_id', new.person_id,
        'department', new.department
      )
    );
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Trigger: Auto-schedule new commitments
drop trigger if exists trigger_new_commitment on mb.commitments;
create trigger trigger_new_commitment
  after insert on mb.commitments
  for each row
  execute function mb.handle_new_commitment();

-- Function: Handle commitment status changes
create or replace function mb.handle_commitment_status_change()
returns trigger as $$
begin
  -- If commitment was completed, clear next_ping_at
  if old.status != 'completed' and new.status = 'completed' then
    new.next_ping_at := null;
    new.completed_at := now();
    
    -- Update person's streak
    update mb.people
    set streak_days = case
      when old.proof_mode = 'require' and not exists(
        select 1 from mb.evidence where commitment_id = new.id
      ) then streak_days  -- No increment for required proof without evidence
      else streak_days + 1
    end,
    trust_score = case
      when old.proof_mode = 'require' and not exists(
        select 1 from mb.evidence where commitment_id = new.id
      ) then greatest(0, trust_score - 1)  -- Decrease trust if proof required but missing
      else least(10, trust_score + 1)  -- Increase trust
    end
    where id = new.person_id;
    
    -- Log the event
    insert into mb.events (type, subject_type, subject_id, metadata)
    values (
      'commitment_completed',
      'commitment',
      new.id,
      jsonb_build_object(
        'person_id', new.person_id,
        'proof_provided', exists(select 1 from mb.evidence where commitment_id = new.id),
        'proof_required', old.proof_mode = 'require'
      )
    );
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Trigger: Handle status changes
drop trigger if exists trigger_commitment_status_change on mb.commitments;
create trigger trigger_commitment_status_change
  before update on mb.commitments
  for each row
  execute function mb.handle_commitment_status_change();