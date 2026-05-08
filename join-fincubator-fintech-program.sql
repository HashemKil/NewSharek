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
    where title = 'JOIN Fincubator FinTech Program 2026'
       or source_url = 'https://www.joinfincubator.com/programs/incubation/'
  ) then
    update public.events
    set
      title = 'JOIN Fincubator FinTech Program 2026',
      category = 'Competition',
      description = 'JOIN Fincubator incubation program for early-stage fintech founders in Jordan. The program helps teams move from fintech idea to market readiness through bootcamp training, technical validation, mentorship, MVP development, digital sandbox/API access, networking, and demo day pitching. Eligible solutions include payments, savings, wealth management, investment, lending, insurtech, open banking, regtech, suptech, remittances, consumer banking, corporate banking, and other fintech verticals.',
      prize = 'Mentorship, workshops, digital sandbox access, MVP development support, networking and exposure to financial ecosystem stakeholders, investors, and accelerators. No fixed cash prize was published on the official program page.',
      event_date = date '2026-04-30',
      end_date = date '2026-11-30',
      registration_deadline = timestamptz '2026-04-16 23:59:00+03',
      start_time = null,
      end_time = null,
      location = 'Amman, Jordan',
      location_details = 'Physical program in Amman, Jordan. Official JOIN page says applicants must be physically present in Amman to attend sessions and workshops, and describes a 7-to-8 month journey: 4-week bootcamp, 3-month Fit phase, 3-month Launch phase, then Demo Day. LinkedIn updates in spring 2026 indicate Cohort 4 applications closed recently and the new cohort started bootcamp, but exact application deadline, exact start date, team size, cohort capacity, and session schedule were not published in the official page found. Dates here are estimated from public LinkedIn timing and should be treated as registration closed unless JOIN reopens applications.',
      source_url = 'https://www.joinfincubator.com/programs/incubation/',
      approval_status = 'approved',
      is_club_members_only = false,
      club_id = null,
      is_team_based = true,
      is_university_event = false,
      max_capacity = null,
      team_min_size = 2,
      team_max_size = 5
    where title = 'JOIN Fincubator FinTech Program 2026'
       or source_url = 'https://www.joinfincubator.com/programs/incubation/';
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
      'JOIN Fincubator FinTech Program 2026',
      'Competition',
      'JOIN Fincubator incubation program for early-stage fintech founders in Jordan. The program helps teams move from fintech idea to market readiness through bootcamp training, technical validation, mentorship, MVP development, digital sandbox/API access, networking, and demo day pitching. Eligible solutions include payments, savings, wealth management, investment, lending, insurtech, open banking, regtech, suptech, remittances, consumer banking, corporate banking, and other fintech verticals.',
      'Mentorship, workshops, digital sandbox access, MVP development support, networking and exposure to financial ecosystem stakeholders, investors, and accelerators. No fixed cash prize was published on the official program page.',
      date '2026-04-30',
      date '2026-11-30',
      timestamptz '2026-04-16 23:59:00+03',
      null,
      null,
      'Amman, Jordan',
      'Physical program in Amman, Jordan. Official JOIN page says applicants must be physically present in Amman to attend sessions and workshops, and describes a 7-to-8 month journey: 4-week bootcamp, 3-month Fit phase, 3-month Launch phase, then Demo Day. LinkedIn updates in spring 2026 indicate Cohort 4 applications closed recently and the new cohort started bootcamp, but exact application deadline, exact start date, team size, cohort capacity, and session schedule were not published in the official page found. Dates here are estimated from public LinkedIn timing and should be treated as registration closed unless JOIN reopens applications.',
      'https://www.joinfincubator.com/programs/incubation/',
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
