alter table public.events
add column if not exists end_date date;

alter table public.events
add column if not exists registration_deadline timestamptz;

alter table public.events
add column if not exists prize text;

alter table public.events
add column if not exists location_details text;

alter table public.events
add column if not exists start_time time;

alter table public.events
add column if not exists end_time time;

alter table public.events
add column if not exists max_capacity integer;

alter table public.events
add column if not exists is_team_based boolean not null default false;

alter table public.events
add column if not exists is_university_event boolean not null default false;

alter table public.events
add column if not exists is_club_members_only boolean not null default false;

alter table public.events
add column if not exists registered_count integer not null default 0;

alter table public.teams
add column if not exists status text not null default 'approved';

alter table public.teams
drop constraint if exists teams_status_check;

alter table public.teams
add constraint teams_status_check
check (status in ('pending', 'approved', 'rejected'));

drop policy if exists "Authenticated users can view clubs" on public.clubs;
create policy "Authenticated users can view clubs"
on public.clubs
for select
to authenticated
using (true);

drop policy if exists "Admins can update any team" on public.teams;
create policy "Admins can update any team"
on public.teams
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins can manage team members" on public.team_members;
create policy "Admins can manage team members"
on public.team_members
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

alter table public.events
drop constraint if exists events_max_capacity_positive;

alter table public.events
add constraint events_max_capacity_positive
check (max_capacity is null or max_capacity > 0);

update public.events
set category = case
  when title ilike '%hackathon%' or description ilike '%hackathon%' then 'Competition'
  when title ilike '%competition%' or description ilike '%competition%' then 'Competition'
  when title ilike '%contest%' or description ilike '%contest%' then 'Competition'
  when title ilike '%challenge%' or description ilike '%challenge%' then 'Competition'
  when category in ('Hackathon', 'Competition') then 'Competition'
  when title ilike '%workshop%' or description ilike '%workshop%' then 'Academic'
  when title ilike '%seminar%' or description ilike '%seminar%' then 'Academic'
  when title ilike '%training%' or description ilike '%training%' then 'Academic'
  when title ilike '%conference%' or description ilike '%conference%' then 'Academic'
  when category in ('Workshop', 'Seminar', 'Conference', 'Training') then 'Academic'
  when title ilike '%career%' or description ilike '%career%' then 'Career'
  when title ilike '%internship%' or description ilike '%internship%' then 'Career'
  when category = 'Career' then 'Career'
  when title ilike '%social%' or description ilike '%social%' then 'Social'
  when title ilike '%gathering%' or description ilike '%gathering%' then 'Social'
  when title ilike '%meetup%' or description ilike '%meetup%' then 'Social'
  when category = 'Social' then 'Social'
  when title ilike '%technology%' or description ilike '%technology%' then 'Technology'
  when title ilike '%software%' or description ilike '%software%' then 'Technology'
  when title ilike '%coding%' or description ilike '%coding%' then 'Technology'
  when title ilike '%cyber%' or description ilike '%cyber%' then 'Technology'
  when category = 'Technology' then 'Technology'
  else category
end
where category is not null;

update public.events
set category = 'Other'
where category is not null
  and category not in (
    'Academic',
    'Technology',
    'Career',
    'Competition',
    'Social',
    'Other'
  );

alter table public.events
drop constraint if exists events_category_check;

alter table public.events
add constraint events_category_check
check (
  category is null
  or category in (
    'Academic',
    'Technology',
    'Career',
    'Competition',
    'Social',
    'Other'
  )
);

notify pgrst, 'reload schema';
