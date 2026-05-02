alter table public.clubs
add column if not exists club_admin_id uuid references public.profiles(id) on delete set null;

create index if not exists clubs_club_admin_id_idx
on public.clubs (club_admin_id);

comment on column public.clubs.club_admin_id is
'Profile id of the user who manages this club as club admin.';

notify pgrst, 'reload schema';
