drop policy if exists "Admins can view all club members" on public.club_members;
create policy "Admins can view all club members"
on public.club_members
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Club admins can view members of their clubs" on public.club_members;
create policy "Club admins can view members of their clubs"
on public.club_members
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    join public.club_members as manager_membership
      on manager_membership.user_id = profiles.id
    where profiles.id = auth.uid()
      and profiles.is_club_admin = true
      and manager_membership.club_id = club_members.club_id
  )
);

drop policy if exists "Admins can remove any club member" on public.club_members;
create policy "Admins can remove any club member"
on public.club_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Club admins can remove members from their clubs" on public.club_members;
create policy "Club admins can remove members from their clubs"
on public.club_members
for delete
to authenticated
using (
  club_members.user_id <> auth.uid()
  and exists (
    select 1
    from public.profiles
    join public.club_members as manager_membership
      on manager_membership.user_id = profiles.id
    where profiles.id = auth.uid()
      and profiles.is_club_admin = true
      and manager_membership.club_id = club_members.club_id
  )
);

notify pgrst, 'reload schema';
