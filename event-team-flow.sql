alter table public.events
add column if not exists is_team_based boolean not null default false;

alter table public.events
add column if not exists is_university_event boolean not null default false;

alter table public.teams
add column if not exists is_open_to_members boolean not null default true;

update public.teams
set max_members = 6
where max_members is null or max_members > 6;

alter table public.teams
alter column max_members set default 6;

alter table public.teams
drop constraint if exists teams_max_members_limit;

alter table public.teams
add constraint teams_max_members_limit
check (max_members between 2 and 6);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  email text,
  student_id text,
  major text,
  academic_year text,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'invited')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.team_members
drop constraint if exists team_members_status_check;

alter table public.team_members
add constraint team_members_status_check
check (status in ('pending', 'approved', 'rejected', 'invited'));

alter table public.event_registrations enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users can view their event registrations" on public.event_registrations;
create policy "Users can view their event registrations"
on public.event_registrations
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can register themselves for events" on public.event_registrations;
create policy "Users can register themselves for events"
on public.event_registrations
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their event registrations" on public.event_registrations;
create policy "Users can update their event registrations"
on public.event_registrations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can leave their event registrations" on public.event_registrations;
create policy "Users can leave their event registrations"
on public.event_registrations
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can view team members" on public.team_members;
create policy "Users can view team members"
on public.team_members
for select
to authenticated
using (true);

drop policy if exists "Users can request to join teams" on public.team_members;
create policy "Users can request to join teams"
on public.team_members
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Team owners can add members" on public.team_members;
create policy "Team owners can add members"
on public.team_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and teams.owner_id = auth.uid()
  )
);

drop policy if exists "Users can update their team request" on public.team_members;
create policy "Users can update their team request"
on public.team_members
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Team owners can update team members" on public.team_members;
create policy "Team owners can update team members"
on public.team_members
for update
to authenticated
using (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and teams.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and teams.owner_id = auth.uid()
  )
);

drop policy if exists "Team owners can remove team members" on public.team_members;
create policy "Team owners can remove team members"
on public.team_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and teams.owner_id = auth.uid()
  )
);

drop policy if exists "Users can cancel their team requests" on public.team_members;
create policy "Users can cancel their team requests"
on public.team_members
for delete
to authenticated
using (auth.uid() = user_id and status = 'pending');

drop policy if exists "Users can create their own teams" on public.teams;
create policy "Users can create their own teams"
on public.teams
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Users can view teams" on public.teams;
create policy "Users can view teams"
on public.teams
for select
to authenticated
using (true);

drop policy if exists "Team owners can update their teams" on public.teams;
create policy "Team owners can update their teams"
on public.teams
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create or replace function public.sync_event_registered_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.events
    set registered_count = coalesce(registered_count, 0) + 1
    where id = new.event_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.events
    set registered_count = greatest(coalesce(registered_count, 0) - 1, 0)
    where id = old.event_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists sync_event_registered_count_insert on public.event_registrations;
create trigger sync_event_registered_count_insert
after insert on public.event_registrations
for each row execute function public.sync_event_registered_count();

drop trigger if exists sync_event_registered_count_delete on public.event_registrations;
create trigger sync_event_registered_count_delete
after delete on public.event_registrations
for each row execute function public.sync_event_registered_count();

create or replace function public.enforce_team_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  approved_count integer;
  allowed_count integer;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  select count(*)
  into approved_count
  from public.team_members
  where team_id = new.team_id
    and status = 'approved'
    and id is distinct from new.id;

  select least(coalesce(max_members, 6), 6)
  into allowed_count
  from public.teams
  where id = new.team_id;

  if approved_count >= coalesce(allowed_count, 6) then
    raise exception 'This team already has the maximum 6 members.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_team_member_limit_insert on public.team_members;
create trigger enforce_team_member_limit_insert
before insert on public.team_members
for each row execute function public.enforce_team_member_limit();

drop trigger if exists enforce_team_member_limit_update on public.team_members;
create trigger enforce_team_member_limit_update
before update on public.team_members
for each row execute function public.enforce_team_member_limit();

create or replace function public.enforce_one_team_per_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event text;
  existing_student_id text;
begin
  if new.status = 'rejected' then
    return new;
  end if;

  select event
  into target_event
  from public.teams
  where id = new.team_id;

  if target_event is null then
    return new;
  end if;

  select profiles.student_id
  into existing_student_id
  from public.team_members
  join public.teams on teams.id = team_members.team_id
  join public.profiles on profiles.id = team_members.user_id
  where teams.event = target_event
    and team_members.user_id = new.user_id
    and team_members.status <> 'rejected'
    and team_members.id is distinct from new.id
  limit 1;

  if existing_student_id is not null then
    raise exception 'The member with Student ID % is already in a team for this event.', existing_student_id;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_one_team_per_event_insert on public.team_members;
create trigger enforce_one_team_per_event_insert
before insert on public.team_members
for each row execute function public.enforce_one_team_per_event();

drop trigger if exists enforce_one_team_per_event_update on public.team_members;
create trigger enforce_one_team_per_event_update
before update on public.team_members
for each row execute function public.enforce_one_team_per_event();
