alter table public.events add column if not exists end_date date;
alter table public.events add column if not exists registration_deadline timestamptz;
alter table public.events add column if not exists prize text;
alter table public.events add column if not exists location_details text;
alter table public.events add column if not exists start_time time;
alter table public.events add column if not exists end_time time;
alter table public.events add column if not exists is_team_based boolean default false;
alter table public.events add column if not exists is_university_event boolean default false;
alter table public.events add column if not exists max_capacity integer;
alter table public.events add column if not exists team_min_size integer;
alter table public.events add column if not exists team_max_size integer;

do $$
declare
  tedx_club_id uuid;
  ieee_club_id uuid;
begin
  select id into tedx_club_id
  from public.clubs
  where name ilike '%TEDxPSUT%' or name ilike '%TEDx%'
  order by name
  limit 1;

  select id into ieee_club_id
  from public.clubs
  where name ilike '%IEEE%'
  order by name
  limit 1;

  create temporary table if not exists seed_events_2026 (
    title text,
    category text,
    description text,
    prize text,
    event_date date,
    end_date date,
    registration_deadline timestamptz,
    start_time time,
    end_time time,
    location text,
    location_details text,
    source_url text,
    approval_status text,
    is_club_members_only boolean,
    club_id uuid,
    is_team_based boolean,
    is_university_event boolean,
    max_capacity integer,
    team_min_size integer,
    team_max_size integer
  ) on commit drop;

  insert into seed_events_2026 values
  (
    'NASA Space Apps Challenge 2026 (Expected)', 'Competition',
    'A global hackathon organized by NASA where participants solve real-world challenges using space and Earth data. Open to developers, designers, and innovators. Dates are based on previous editions and will be updated once officially announced.',
    'Global recognition + NASA awards', date '2026-10-03', date '2026-10-05', timestamptz '2026-09-25 23:59:00+03',
    null, null, 'Global (Amman Local Hub Available)',
    'Expected 2026 cycle. Local Amman hub availability should be confirmed once NASA publishes the official 2026 local events.',
    'https://www.spaceappschallenge.org', 'approved', false, null, true, false, 100, 2, 6
  ),
  (
    'Kaggle Data Science Competition - May 2026', 'Technology',
    'A global machine learning competition where participants build predictive models using real-world datasets and compete on rankings.',
    'Cash prizes + global ranking', date '2026-05-01', date '2026-05-31', timestamptz '2026-05-25 23:59:00+03',
    null, null, 'Online', 'Online competition hosted through Kaggle competitions.',
    'https://www.kaggle.com/competitions', 'approved', false, null, false, false, null, null, null
  ),
  (
    'ZINC AI Bootcamp 2026', 'Academic',
    'An intensive AI bootcamp covering machine learning basics, real-world use cases, and hands-on projects.',
    'Certificate of completion', date '2026-05-20', date '2026-05-25', timestamptz '2026-05-15 23:59:00+03',
    null, null, 'ZINC Amman', 'ZINC Amman. Exact room and daily session times TBA.',
    'https://zinc.jo', 'approved', false, null, false, false, 40, null, null
  ),
  (
    'Startup Weekend Amman 2026', 'Competition',
    'A 54-hour startup event where participants pitch ideas, form teams, and build real startups with mentorship.',
    'Funding opportunities + incubation', date '2026-06-12', date '2026-06-14', timestamptz '2026-06-08 23:59:00+03',
    null, null, 'Amman', 'Teams are created during the event. Exact venue and daily schedule TBA.',
    'https://www.techstars.com/startup-weekend', 'approved', false, null, true, false, 25, 3, 5
  ),
  (
    'PSUT AI Hackathon 2026', 'Competition',
    'A university-wide hackathon focused on building AI-powered solutions for real-world problems.',
    '1000 JOD + internship opportunities', date '2026-06-05', date '2026-06-06', timestamptz '2026-06-02 23:59:00+03',
    null, null, 'PSUT Campus', 'Demo event. Exact room, detailed schedule, and organizer details TBA.',
    null, 'approved', false, null, true, true, 20, 3, 4
  ),
  (
    'TEDxPSUT Speaker Info Session', 'Social',
    'An info session for students interested in becoming speakers at TEDxPSUT events.',
    null, date '2026-05-18', date '2026-05-18', timestamptz '2026-05-17 23:59:00+03',
    null, null, 'PSUT Auditorium', 'Owned by TEDxPSUT if the club exists in the database.',
    null, 'approved', false, tedx_club_id, false, true, 80, null, null
  ),
  (
    'IEEE Cybersecurity Workshop', 'Technology',
    'Hands-on workshop covering ethical hacking, network security, and real-world cyber threats.',
    null, date '2026-05-22', date '2026-05-22', timestamptz '2026-05-21 23:59:00+03',
    null, null, 'PSUT', 'Owned by IEEE if the club exists in the database. Exact room and session time TBA.',
    null, 'approved', false, ieee_club_id, false, true, 40, null, null
  ),
  (
    'Google Solution Challenge 2026', 'Competition',
    'Students build solutions aligned with UN Sustainable Development Goals using Google technologies.',
    'Google mentorship + global recognition', date '2026-03-01', date '2026-06-30', timestamptz '2026-03-20 23:59:00+03',
    null, null, 'Online', 'Online student solution challenge. Team creation supported in Sharek.',
    'https://developers.google.com/community/gdsc-solution-challenge', 'approved', false, null, true, false, null, 2, 4
  ),
  (
    'Global Game Jam 2026', 'Competition',
    'A worldwide game development event where participants create games in 48 hours.',
    'Portfolio + exposure', date '2026-01-24', date '2026-01-26', timestamptz '2026-01-20 23:59:00+03',
    null, null, 'Global (Local hubs available)', 'Global Game Jam event. Local hub details should be checked on the official site.',
    'https://globalgamejam.org', 'approved', false, null, true, false, null, 2, 5
  );

  update public.events e
  set
    category = s.category,
    description = s.description,
    prize = s.prize,
    event_date = s.event_date,
    end_date = s.end_date,
    registration_deadline = s.registration_deadline,
    start_time = s.start_time,
    end_time = s.end_time,
    location = s.location,
    location_details = s.location_details,
    source_url = s.source_url,
    approval_status = s.approval_status,
    is_club_members_only = s.is_club_members_only,
    club_id = s.club_id,
    is_team_based = s.is_team_based,
    is_university_event = s.is_university_event,
    max_capacity = s.max_capacity,
    team_min_size = s.team_min_size,
    team_max_size = s.team_max_size
  from seed_events_2026 s
  where e.title = s.title;

  insert into public.events (
    title, category, description, prize, event_date, end_date, registration_deadline,
    start_time, end_time, location, location_details, source_url, approval_status,
    is_club_members_only, club_id, is_team_based, is_university_event,
    max_capacity, team_min_size, team_max_size
  )
  select
    s.title, s.category, s.description, s.prize, s.event_date, s.end_date, s.registration_deadline,
    s.start_time, s.end_time, s.location, s.location_details, s.source_url, s.approval_status,
    s.is_club_members_only, s.club_id, s.is_team_based, s.is_university_event,
    s.max_capacity, s.team_min_size, s.team_max_size
  from seed_events_2026 s
  where not exists (
    select 1
    from public.events e
    where e.title = s.title
  );
end $$;

notify pgrst, 'reload schema';
