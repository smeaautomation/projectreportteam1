create table if not exists public.dashboard_state (
  id text primary key check (id = 'team1'),
  projects jsonb not null,
  revision bigint not null check (revision >= 1),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

alter table public.dashboard_state enable row level security;
alter table public.dashboard_state replica identity full;

revoke all on table public.dashboard_state from anon, authenticated;
grant select on table public.dashboard_state to anon, authenticated;
grant select, insert, update, delete on table public.dashboard_state to service_role;

drop policy if exists "team1 dashboard is publicly readable" on public.dashboard_state;
create policy "team1 dashboard is publicly readable"
  on public.dashboard_state
  for select
  to anon, authenticated
  using (id = 'team1');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dashboard_state'
  ) then
    alter publication supabase_realtime add table public.dashboard_state;
  end if;
end
$$;
