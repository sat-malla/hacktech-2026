-- ===========================================================================
-- Real-time pipeline schema setup for the `readings` table.
--
-- Idempotent — safe to re-run. Apply via Supabase SQL editor or psql.
--
-- Reference: the user-supplied graph spec uses a generic `Message` entity:
--
--   create table messages (
--     id          uuid primary key default gen_random_uuid(),
--     content     text not null check (length(content) > 0),
--     created_at  timestamptz not null default now()
--   );
--   alter publication supabase_realtime add table messages;
--
-- This file applies the same pattern to the existing soil-monitor `readings`
-- table — but ALIGNED to the schema that already exists in this Supabase
-- project: `id` is an integer auto-increment, and the insertion-time column
-- is named `timestamp` (not `created_at`). schema_spec.py mirrors this.
-- ===========================================================================

-- 1. Ensure `id` is an identity primary key (auto-increment integer).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.readings'::regclass and contype = 'p'
  ) then
    alter table public.readings add primary key (id);
  end if;
end $$;

-- Make sure id is NOT NULL (an identity column always is, but cover the case
-- where the table was created without identity by attaching a sequence).
do $$
declare
  has_default boolean;
begin
  select column_default is not null
    into has_default
    from information_schema.columns
    where table_schema='public' and table_name='readings' and column_name='id';

  if not has_default then
    create sequence if not exists public.readings_id_seq;
    alter table public.readings alter column id set default nextval('public.readings_id_seq');
    perform setval('public.readings_id_seq', coalesce((select max(id) from public.readings), 0) + 1, false);
    alter sequence public.readings_id_seq owned by public.readings.id;
  end if;
end $$;

alter table public.readings alter column id set not null;

-- 2. Server-generated `timestamp` (the existing column name on this project).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='readings' and column_name='timestamp'
  ) then
    alter table public.readings add column "timestamp" timestamptz not null default now();
  else
    alter table public.readings alter column "timestamp" set default now();
    alter table public.readings alter column "timestamp" set not null;
  end if;
end $$;

-- 3. NOT NULL on the spec-required fields.
alter table public.readings alter column monitor_id      set not null;
alter table public.readings alter column plant_species   set not null;
alter table public.readings alter column soil_moisture   set not null;
alter table public.readings alter column air_temperature set not null;
alter table public.readings alter column soil_temperature set not null;
alter table public.readings alter column water_level     set not null;
alter table public.readings alter column drainage        set not null;

-- 4. Domain check: plant_species must be non-empty.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'readings_plant_species_nonempty'
  ) then
    alter table public.readings
      add constraint readings_plant_species_nonempty
      check (length(plant_species) > 0);
  end if;
end $$;

-- 5. Range check: soil_moisture is a 0–100 percentage.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'readings_soil_moisture_range'
  ) then
    alter table public.readings
      add constraint readings_soil_moisture_range
      check (soil_moisture >= 0 and soil_moisture <= 100);
  end if;
end $$;

-- 6. Range check: water_level is non-negative.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'readings_water_level_nonneg'
  ) then
    alter table public.readings
      add constraint readings_water_level_nonneg
      check (water_level >= 0);
  end if;
end $$;

-- 7. Index for the most common Realtime "give me the latest N rows" query.
create index if not exists readings_timestamp_idx
  on public.readings ("timestamp" desc);

-- 8. Enable Realtime replication on the table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'readings'
  ) then
    alter publication supabase_realtime add table public.readings;
  end if;
end $$;

-- 9. (Optional) If RLS is later enabled, the anon role needs SELECT for the
--    frontend Realtime subscription to deliver INSERT events.
--
-- alter table public.readings enable row level security;
-- create policy "anon can read readings"
--   on public.readings for select
--   to anon
--   using (true);
