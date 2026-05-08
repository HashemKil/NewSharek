alter table public.events
add column if not exists image_url text;

notify pgrst, 'reload schema';
