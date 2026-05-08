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
    where title = 'ICPC Jordan Collegiate Programming Contest (JCPC) 2026'
  ) then
    update public.events
    set
      title = 'ICPC Jordan Collegiate Programming Contest (JCPC) 2026',
      category = 'Competition',
      description = 'Estimated 2026 Jordanian Collegiate Programming Contest entry. JCPC is Jordan''s ICPC-style national collegiate programming contest where university teams compete in algorithmic problem solving, coding speed, teamwork, and contest strategy. Official ICPC-style contests use teams of three students, one computer, and a five-hour problem-solving contest. Top Jordanian teams typically qualify to the Arab and African Collegiate Programming Contest (ACPC).',
      prize = 'Qualification path to ACPC / regional ICPC contests; medals, ranking, and national recognition. Exact 2026 awards not yet announced.',
      event_date = date '2026-10-10',
      end_date = date '2026-10-10',
      registration_deadline = timestamptz '2026-09-25 23:59:00+03',
      start_time = time '09:00',
      end_time = time '14:00',
      location = 'Jordan - host university TBA',
      location_details = 'Estimated 2026 cycle. No official JCPC 2026 page was found as of 7 May 2026. The 2025 JCPC was hosted by Applied Science Private University and included 101 teams from Jordanian public and private universities, according to PSUT. The exact 2026 host site, registration URL, registration deadline, contest date, capacity, and local PSUT arrangements must be updated when the official announcement is published.',
      source_url = 'https://scoreboard.acpc.global/jcpc2025/',
      approval_status = 'approved',
      is_club_members_only = false,
      club_id = null,
      is_team_based = true,
      is_university_event = false,
      max_capacity = null,
      team_min_size = 3,
      team_max_size = 3
    where title = 'ICPC Jordan Collegiate Programming Contest (JCPC) 2026';
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
      'ICPC Jordan Collegiate Programming Contest (JCPC) 2026',
      'Competition',
      'Estimated 2026 Jordanian Collegiate Programming Contest entry. JCPC is Jordan''s ICPC-style national collegiate programming contest where university teams compete in algorithmic problem solving, coding speed, teamwork, and contest strategy. Official ICPC-style contests use teams of three students, one computer, and a five-hour problem-solving contest. Top Jordanian teams typically qualify to the Arab and African Collegiate Programming Contest (ACPC).',
      'Qualification path to ACPC / regional ICPC contests; medals, ranking, and national recognition. Exact 2026 awards not yet announced.',
      date '2026-10-10',
      date '2026-10-10',
      timestamptz '2026-09-25 23:59:00+03',
      time '09:00',
      time '14:00',
      'Jordan - host university TBA',
      'Estimated 2026 cycle. No official JCPC 2026 page was found as of 7 May 2026. The 2025 JCPC was hosted by Applied Science Private University and included 101 teams from Jordanian public and private universities, according to PSUT. The exact 2026 host site, registration URL, registration deadline, contest date, capacity, and local PSUT arrangements must be updated when the official announcement is published.',
      'https://scoreboard.acpc.global/jcpc2025/',
      'approved',
      false,
      null,
      true,
      false,
      null,
      3,
      3
    );
  end if;
end $$;

notify pgrst, 'reload schema';
