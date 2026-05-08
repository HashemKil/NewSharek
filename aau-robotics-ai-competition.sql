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
add column if not exists is_team_based boolean default false;

alter table public.events
add column if not exists is_university_event boolean default false;

alter table public.events
add column if not exists max_capacity integer;

alter table public.events
add column if not exists team_min_size integer;

alter table public.events
add column if not exists team_max_size integer;

do $$
begin
  if exists (
    select 1
    from public.events
    where title = 'Amman Arab University Robotics & AI Competition 2026'
       or source_url = 'https://aau-robotics.competitions.sbs/'
  ) then
    update public.events
    set
      title = 'Amman Arab University Robotics & AI Competition 2026',
      category = 'Technology',
      description = 'Regional student robotics and artificial intelligence competition for Arab and regional universities and colleges. Competition tracks include practical robotics, research and development, and creative ideas. Students form teams, develop innovative robotics or AI projects, and compete for cash prizes.',
      prize = 'Cash prizes over USD 10,000',
      event_date = date '2026-05-10',
      end_date = date '2026-05-10',
      registration_deadline = timestamptz '2026-05-07 23:59:00+03',
      start_time = time '09:00',
      end_time = time '17:00',
      location = 'Amman Arab University, Amman, Jordan',
      location_details = 'Main campus - exact hall TBA. Registration/details page: https://aau-robotics.competitions.sbs/. Official public announcements confirm the event date, Amman location, three competition tracks, and prizes over USD 10,000; exact hall, capacity, and daily schedule were not published in the sources found.',
      source_url = 'https://aau-robotics.competitions.sbs/',
      approval_status = 'approved',
      is_club_members_only = false,
      club_id = null,
      is_team_based = true,
      is_university_event = false,
      max_capacity = null,
      team_min_size = 2,
      team_max_size = 5
    where title = 'Amman Arab University Robotics & AI Competition 2026'
       or source_url = 'https://aau-robotics.competitions.sbs/';
  else
    insert into public.events (
      title,
      category,
      description,
      prize,
      event_date,
      end_date,
      registration_deadline,
      start_time,
      end_time,
      location,
      location_details,
      source_url,
      approval_status,
      is_club_members_only,
      club_id,
      is_team_based,
      is_university_event,
      max_capacity,
      team_min_size,
      team_max_size
    )
    values (
      'Amman Arab University Robotics & AI Competition 2026',
      'Technology',
      'Regional student robotics and artificial intelligence competition for Arab and regional universities and colleges. Competition tracks include practical robotics, research and development, and creative ideas. Students form teams, develop innovative robotics or AI projects, and compete for cash prizes.',
      'Cash prizes over USD 10,000',
      date '2026-05-10',
      date '2026-05-10',
      timestamptz '2026-05-07 23:59:00+03',
      time '09:00',
      time '17:00',
      'Amman Arab University, Amman, Jordan',
      'Main campus - exact hall TBA. Registration/details page: https://aau-robotics.competitions.sbs/. Official public announcements confirm the event date, Amman location, three competition tracks, and prizes over USD 10,000; exact hall, capacity, and daily schedule were not published in the sources found.',
      'https://aau-robotics.competitions.sbs/',
      'approved',
      false,
      null,
      true,
      false,
      null,
      2,
      5
    );
  end if;
end $$;

notify pgrst, 'reload schema';
