alter table public.dashboard_state
  add column if not exists weekly_obstacles jsonb not null default '{}'::jsonb
  check (jsonb_typeof(weekly_obstacles) = 'object');
