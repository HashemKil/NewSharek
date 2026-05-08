alter table public.event_registrations
add column if not exists status text not null default 'approved';

alter table public.event_registrations
drop constraint if exists event_registrations_status_check;

alter table public.event_registrations
add constraint event_registrations_status_check
check (status in ('pending', 'approved', 'rejected'));

update public.event_registrations
set status = 'approved'
where status is null;

drop policy if exists "Club admins can view registrations for owned events" on public.event_registrations;
create policy "Club admins can view registrations for owned events"
on public.event_registrations
for select
to authenticated
using (
  exists (
    select 1
    from public.events
    join public.clubs
      on clubs.id = events.club_id
    where events.id = event_registrations.event_id
      and clubs.club_admin_id = auth.uid()
  )
);

drop policy if exists "Club admins can approve registrations for owned events" on public.event_registrations;
create policy "Club admins can approve registrations for owned events"
on public.event_registrations
for update
to authenticated
using (
  exists (
    select 1
    from public.events
    join public.clubs
      on clubs.id = events.club_id
    where events.id = event_registrations.event_id
      and clubs.club_admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events
    join public.clubs
      on clubs.id = events.club_id
    where events.id = event_registrations.event_id
      and clubs.club_admin_id = auth.uid()
  )
);

create or replace function public.sync_event_registered_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'approved' then
      update public.events
      set registered_count = coalesce(registered_count, 0) + 1
      where id = new.event_id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if coalesce(old.status, 'approved') <> 'approved' and new.status = 'approved' then
      update public.events
      set registered_count = coalesce(registered_count, 0) + 1
      where id = new.event_id;
    elsif coalesce(old.status, 'approved') = 'approved' and new.status <> 'approved' then
      update public.events
      set registered_count = greatest(coalesce(registered_count, 0) - 1, 0)
      where id = new.event_id;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'approved' then
      update public.events
      set registered_count = greatest(coalesce(registered_count, 0) - 1, 0)
      where id = old.event_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists sync_event_registered_count_insert on public.event_registrations;
create trigger sync_event_registered_count_insert
after insert on public.event_registrations
for each row execute function public.sync_event_registered_count();

drop trigger if exists sync_event_registered_count_update on public.event_registrations;
create trigger sync_event_registered_count_update
after update on public.event_registrations
for each row execute function public.sync_event_registered_count();

drop trigger if exists sync_event_registered_count_delete on public.event_registrations;
create trigger sync_event_registered_count_delete
after delete on public.event_registrations
for each row execute function public.sync_event_registered_count();

create or replace function public.recalculate_event_registered_counts()
returns void
language sql
security definer
set search_path = public
as $$
  update public.events
  set registered_count = coalesce(counts.approved_count, 0)
  from (
    select events.id, count(event_registrations.id) as approved_count
    from public.events
    left join public.event_registrations
      on event_registrations.event_id = events.id
      and event_registrations.status = 'approved'
    group by events.id
  ) as counts
  where events.id = counts.id;
$$;

select public.recalculate_event_registered_counts();

notify pgrst, 'reload schema';
