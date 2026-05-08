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

do $$
begin
  if exists (
    select 1
    from public.events
    where title = 'Prompt and Play Hackathon'
       or source_url = 'https://zinchackathons.com'
  ) then
    update public.events
    set
      title = 'Prompt and Play Hackathon',
      category = 'Competition',
      description = 'Team-based in-person hackathon focused on AI game development. Participants build next-generation games using Replit tools, explore monetization, UX/UI, creative design, and present their final projects in a pitching format. Organized by ZINC, Replit, and Tamatem. Exact daily times, team size limit, and total team capacity are still TBA.',
      prize = '1st Place: 1,500 JOD; 2nd Place: 1,000 JOD; 3rd Place: 500 JOD',
      event_date = date '2026-05-14',
      end_date = date '2026-05-16',
      registration_deadline = timestamptz '2026-05-11 23:59:00+03',
      start_time = null,
      end_time = null,
      location = 'King Hussein Business Park (ZINC)',
      location_details = 'In-person event at ZINC in King Hussein Business Park, Amman. Exact daily start/end times, team size limit, and total team capacity are still TBA.',
      source_url = 'https://zinchackathons.com',
      approval_status = 'approved',
      is_club_members_only = false,
      club_id = null,
      is_team_based = true,
      is_university_event = true,
      max_capacity = null
    where title = 'Prompt and Play Hackathon'
       or source_url = 'https://zinchackathons.com';
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
      max_capacity
    )
    values (
      'Prompt and Play Hackathon',
      'Competition',
      'Team-based in-person hackathon focused on AI game development. Participants build next-generation games using Replit tools, explore monetization, UX/UI, creative design, and present their final projects in a pitching format. Organized by ZINC, Replit, and Tamatem. Exact daily times, team size limit, and total team capacity are still TBA.',
      '1st Place: 1,500 JOD; 2nd Place: 1,000 JOD; 3rd Place: 500 JOD',
      date '2026-05-14',
      date '2026-05-16',
      timestamptz '2026-05-11 23:59:00+03',
      null,
      null,
      'King Hussein Business Park (ZINC)',
      'In-person event at ZINC in King Hussein Business Park, Amman. Exact daily start/end times, team size limit, and total team capacity are still TBA.',
      'https://zinchackathons.com',
      'approved',
      false,
      null,
      true,
      true,
      null
    );
  end if;
end $$;

notify pgrst, 'reload schema';
