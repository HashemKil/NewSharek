-- Removes old scraped ZINC events that were imported into pending review.
-- This keeps approved/manual events safe and only deletes unreviewed ZINC rows
-- whose end date/event date has already passed.

delete from public.events
where approval_status = 'pending'
  and source_url ilike 'https://zinc.jo/event/%'
  and coalesce(end_date, event_date) < current_date;
