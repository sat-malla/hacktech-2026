-- ===========================================================================
-- `messages` table — strict-schema reference pipeline.
-- Idempotent — safe to re-run.
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists public.messages (
  id          uuid          primary key default gen_random_uuid(),
  content     text          not null check (length(content) > 0),
  created_at  timestamptz   not null default now()
);

create index if not exists messages_created_at_idx
  on public.messages (created_at desc);

-- Enable Realtime broadcast for INSERT/UPDATE/DELETE on this table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- (Optional) RLS — uncomment when going beyond hackathon scope.
--
-- alter table public.messages enable row level security;
-- create policy "anon can read messages" on public.messages
--   for select to anon using (true);
