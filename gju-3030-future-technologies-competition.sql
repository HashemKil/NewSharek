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
    where title = 'GJU 3030 Future Technologies Competition - Universities Track'
       or source_url = 'https://www.gju.edu.jo/content/universities-competitions-track-2026-21632'
  ) then
    update public.events
    set
      title = 'GJU 3030 Future Technologies Competition - Universities Track',
      category = 'Technology',
      description = 'German Jordanian University 3030 Universities Track 2026 under the theme Future Technologies. The competition targets Jordanian university students and invites projects and ideas in AI and machine learning, robotics and drones, cybersecurity, sustainable and green technologies, IoT, automation in architecture/design, and other emerging technology topics. Participation is coordinated through each university contact person, with shortlisted teams invited to showcase and present to a specialized judging panel.',
      prize = 'Awards for 1st, 2nd, and 3rd place; certificates for all participants. Prize values announced later by GJU.',
      event_date = date '2026-04-28',
      end_date = date '2026-04-28',
      registration_deadline = timestamptz '2026-04-14 23:59:00+03',
      start_time = null,
      end_time = null,
      location = 'German Jordanian University, Madaba, Jordan',
      location_details = 'Main Campus | Madaba. Official GJU page confirms the university track final showcase and presentation date as 28 April 2026 and project submission deadline as 14 April 2026. Exact hall, time, capacity, and team-size limits were not published on the official page.',
      source_url = 'https://www.gju.edu.jo/content/universities-competitions-track-2026-21632',
      approval_status = 'approved',
      is_club_members_only = false,
      club_id = null,
      is_team_based = true,
      is_university_event = false,
      max_capacity = null,
      team_min_size = 3,
      team_max_size = 5
    where title = 'GJU 3030 Future Technologies Competition - Universities Track'
       or source_url = 'https://www.gju.edu.jo/content/universities-competitions-track-2026-21632';
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
      'GJU 3030 Future Technologies Competition - Universities Track',
      'Technology',
      'German Jordanian University 3030 Universities Track 2026 under the theme Future Technologies. The competition targets Jordanian university students and invites projects and ideas in AI and machine learning, robotics and drones, cybersecurity, sustainable and green technologies, IoT, automation in architecture/design, and other emerging technology topics. Participation is coordinated through each university contact person, with shortlisted teams invited to showcase and present to a specialized judging panel.',
      'Awards for 1st, 2nd, and 3rd place; certificates for all participants. Prize values announced later by GJU.',
      date '2026-04-28',
      date '2026-04-28',
      timestamptz '2026-04-14 23:59:00+03',
      null,
      null,
      'German Jordanian University, Madaba, Jordan',
      'Main Campus | Madaba. Official GJU page confirms the university track final showcase and presentation date as 28 April 2026 and project submission deadline as 14 April 2026. Exact hall, time, capacity, and team-size limits were not published on the official page.',
      'https://www.gju.edu.jo/content/universities-competitions-track-2026-21632',
      'approved',
      false,
      null,
      true,
      false,
      null,
      3,
      5
    );
  end if;
end $$;

notify pgrst, 'reload schema';
