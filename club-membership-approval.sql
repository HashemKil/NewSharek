alter table public.club_members
add column if not exists status text not null default 'approved';

alter table public.club_members
drop constraint if exists club_members_status_check;

alter table public.club_members
add constraint club_members_status_check
check (status in ('pending', 'approved', 'rejected'));

update public.club_members
set status = 'approved'
where status is null;

drop policy if exists "Users can join clubs" on public.club_members;
create policy "Users can join clubs"
on public.club_members
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status = 'pending'
);

drop policy if exists "Users can update their own club request" on public.club_members;
create policy "Users can update their own club request"
on public.club_members
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and status = 'pending'
);

drop policy if exists "Club admins can approve member requests" on public.club_members;
create policy "Club admins can approve member requests"
on public.club_members
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    join public.clubs
      on clubs.club_admin_id = profiles.id
    where profiles.id = auth.uid()
      and profiles.is_club_admin = true
      and clubs.id = club_members.club_id
  )
)
with check (
  exists (
    select 1
    from public.profiles
    join public.clubs
      on clubs.club_admin_id = profiles.id
    where profiles.id = auth.uid()
      and profiles.is_club_admin = true
      and clubs.id = club_members.club_id
  )
);

create or replace function public.join_club(target_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
begin
  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null then
    raise exception 'Profile not found for this account.';
  end if;

  insert into public.club_members (
    club_id,
    user_id,
    full_name,
    email,
    student_id,
    major,
    academic_year,
    status
  )
  values (
    target_club_id,
    auth.uid(),
    current_profile.full_name,
    current_profile.email,
    current_profile.student_id,
    current_profile.major,
    current_profile.academic_year,
    'pending'
  )
  on conflict (club_id, user_id)
  do update set
    full_name = excluded.full_name,
    email = excluded.email,
    student_id = excluded.student_id,
    major = excluded.major,
    academic_year = excluded.academic_year,
    status = case
      when public.club_members.status = 'approved' then 'approved'
      else 'pending'
    end;
end;
$$;

create or replace function public.get_club_member_counts()
returns table (
  club_id uuid,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select club_members.club_id, count(*) as member_count
  from public.club_members
  where club_members.status = 'approved'
  group by club_members.club_id;
$$;

create or replace function public.ensure_event_registration_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.events%rowtype;
begin
  select *
  into target_event
  from public.events
  where id = new.event_id;

  if target_event.id is null then
    raise exception 'Event not found.';
  end if;

  if target_event.approval_status is not null and target_event.approval_status <> 'approved' then
    raise exception 'This event is still pending review.';
  end if;

  if target_event.registration_deadline is not null and now() > target_event.registration_deadline then
    raise exception 'Registration deadline has passed.';
  end if;

  if target_event.is_club_members_only then
    if target_event.club_id is null then
      raise exception 'This members-only event is not linked to a club.';
    end if;

    if not exists (
      select 1
      from public.club_members
      where club_members.club_id = target_event.club_id
        and club_members.user_id = new.user_id
        and club_members.status = 'approved'
    ) then
      raise exception 'Only approved members of this club can join this event.';
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
