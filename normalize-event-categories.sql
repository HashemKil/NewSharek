update public.events
set category = case
  when title ilike '%hackathon%' or description ilike '%hackathon%' then 'Competition'
  when title ilike '%competition%' or description ilike '%competition%' then 'Competition'
  when title ilike '%contest%' or description ilike '%contest%' then 'Competition'
  when title ilike '%challenge%' or description ilike '%challenge%' then 'Competition'
  when category in ('Hackathon', 'Competition') then 'Competition'
  when title ilike '%workshop%' or description ilike '%workshop%' then 'Academic'
  when title ilike '%seminar%' or description ilike '%seminar%' then 'Academic'
  when title ilike '%training%' or description ilike '%training%' then 'Academic'
  when title ilike '%conference%' or description ilike '%conference%' then 'Academic'
  when category in ('Workshop', 'Seminar', 'Conference', 'Training') then 'Academic'
  when title ilike '%career%' or description ilike '%career%' then 'Career'
  when title ilike '%internship%' or description ilike '%internship%' then 'Career'
  when category = 'Career' then 'Career'
  when title ilike '%social%' or description ilike '%social%' then 'Social'
  when title ilike '%gathering%' or description ilike '%gathering%' then 'Social'
  when title ilike '%meetup%' or description ilike '%meetup%' then 'Social'
  when category = 'Social' then 'Social'
  when title ilike '%technology%' or description ilike '%technology%' then 'Technology'
  when title ilike '%software%' or description ilike '%software%' then 'Technology'
  when title ilike '%coding%' or description ilike '%coding%' then 'Technology'
  when title ilike '%cyber%' or description ilike '%cyber%' then 'Technology'
  when category = 'Technology' then 'Technology'
  else 'Other'
end
where category is not null;

alter table public.events
drop constraint if exists events_category_check;

alter table public.events
add constraint events_category_check
check (
  category is null
  or category in (
    'Academic',
    'Technology',
    'Career',
    'Competition',
    'Social',
    'Other'
  )
);

notify pgrst, 'reload schema';
