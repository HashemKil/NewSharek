alter table public.events
add column if not exists end_date date;

alter table public.events
add column if not exists registration_deadline timestamptz;

alter table public.events
add column if not exists prize text;

alter table public.events
add column if not exists location_details text;

alter table public.events
add column if not exists is_team_based boolean default false;

alter table public.events
add column if not exists is_university_event boolean default false;

do $$
begin
  if exists (
    select 1
    from public.events
    where title = 'Replit Agent 4 Content Challenge'
  ) then
    update public.events
    set
      title = 'Replit Agent 4 Content Challenge',
      category = 'Competition',
      description = 'General public online content challenge to build a real project with Replit Agent 4 tools and create a video showing what the agent can do. Open to students and developers. Focus areas include AI, full-stack development, automation, content creation, problem solving, creativity, real-world usefulness, and portfolio value. The official exact submission URL, deadline time/timezone, and full judging rules still need final source verification.',
      prize = '$5,000 weekly winners; up to $20,000 total prize pool',
      event_date = date '2026-03-18',
      end_date = date '2026-04-15',
      registration_deadline = timestamptz '2026-04-15 23:59:00+00',
      location = 'Online',
      location_details = 'Online challenge. Sources indicate a four-week challenge launched around March 18, 2026, so this should be treated as completed/registration closed unless an official current page says otherwise.',
      source_url = null,
      approval_status = 'approved',
      is_club_members_only = false,
      club_id = null,
      is_team_based = false,
      is_university_event = false,
      max_capacity = null
    where title = 'Replit Agent 4 Content Challenge';
  else
    insert into public.events (
      title,
      category,
      description,
      prize,
      event_date,
      end_date,
      registration_deadline,
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
      'Replit Agent 4 Content Challenge',
      'Competition',
      'General public online content challenge to build a real project with Replit Agent 4 tools and create a video showing what the agent can do. Open to students and developers. Focus areas include AI, full-stack development, automation, content creation, problem solving, creativity, real-world usefulness, and portfolio value. The official exact submission URL, deadline time/timezone, and full judging rules still need final source verification.',
      '$5,000 weekly winners; up to $20,000 total prize pool',
      date '2026-03-18',
      date '2026-04-15',
      timestamptz '2026-04-15 23:59:00+00',
      'Online',
      'Online challenge. Sources indicate a four-week challenge launched around March 18, 2026, so this should be treated as completed/registration closed unless an official current page says otherwise.',
      null,
      'approved',
      false,
      null,
      false,
      false,
      null
    );
  end if;
end $$;

notify pgrst, 'reload schema';
