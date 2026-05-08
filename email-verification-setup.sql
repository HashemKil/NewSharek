alter table public.profiles
add column if not exists portal_verified boolean not null default false;

alter table public.profiles
add column if not exists phone_number text;

alter table public.profiles enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format(
      'drop policy if exists %I on public.profiles',
      policy_record.policyname
    );
  end loop;
end;
$$;

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Authenticated users can view profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.get_email_by_student_id(p_student_id text)
returns table (email text)
language sql
security definer
set search_path = public
as $$
  select profiles.email
  from public.profiles
  where profiles.student_id = p_student_id
  limit 1;
$$;

grant execute on function public.get_email_by_student_id(text) to anon, authenticated;

notify pgrst, 'reload schema';
