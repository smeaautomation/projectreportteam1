alter table public.dashboard_state
  add column if not exists weekly_policy_counts jsonb not null default '{}'::jsonb
  check (jsonb_typeof(weekly_policy_counts) = 'object');
