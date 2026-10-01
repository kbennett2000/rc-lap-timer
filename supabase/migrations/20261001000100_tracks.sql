-- Shared tracks and their leaderboards (docs/cloud.md). Anyone can look at them, signed in or not. Signed-in people add
-- tracks and post their own sessions' best laps (one post per session), and only the person who posted a lap can
-- change or take it down. Whoever added a track can rename it, and delete it while nobody else has laps on it.

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  -- Where it is, such as "Austin, TX", to tell tracks with the same name apart.
  area text not null default '' check (char_length(area) <= 80 and area = btrim(area)),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index tracks_name_area on public.tracks (lower(name), lower(area));

create table public.lap_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  -- The session on the phone, so posting it again replaces its post.
  session_id uuid not null,
  driver_name text not null check (char_length(driver_name) between 1 and 191),
  car_name text not null check (char_length(car_name) between 1 and 191),
  best_lap_ms integer not null check (best_lap_ms > 0 and best_lap_ms < 3600000),
  best_lap_number integer not null check (best_lap_number > 0),
  -- On the best lap.
  penalties integer not null default 0 check (penalties >= 0),
  lap_count integer not null check (lap_count >= best_lap_number),
  session_date timestamptz not null check (session_date < now() + interval '1 day'),
  posted_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create index lap_records_track on public.lap_records (track_id, best_lap_ms);

alter table public.tracks enable row level security;
alter table public.lap_records enable row level security;

create policy "Everyone sees the tracks" on public.tracks for select to anon, authenticated using (true);
create policy "Signed-in people add tracks" on public.tracks
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Whoever added a track renames it" on public.tracks
  for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "Creators delete their tracks while no one else has laps on them" on public.tracks
  for delete to authenticated using (
    created_by = (select auth.uid())
    and not exists (
      select 1 from public.lap_records r where r.track_id = tracks.id and r.user_id <> (select auth.uid())
    )
  );

create policy "Everyone sees the laps" on public.lap_records for select to anon, authenticated using (true);
create policy "People post their own laps" on public.lap_records
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "People change their own posts" on public.lap_records
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "People take down their own posts" on public.lap_records
  for delete to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.tracks, public.lap_records from anon;

-- Each track with how many laps are posted on it, and whether the signed-in person added it.
create view public.track_list with (security_invoker = true) as
select
  t.id,
  t.name,
  t.area,
  coalesce(t.created_by = (select auth.uid()), false) as mine,
  (select count(*) from public.lap_records r where r.track_id = t.id) as posts
from public.tracks t;

-- A track's leaderboard: each driver's best lap, per account that posted them, fastest first when ordered by
-- best_lap_ms. On a tie, the earlier session ranks first.
create view public.leaderboard with (security_invoker = true) as
select distinct on (track_id, user_id, lower(driver_name))
  id,
  track_id,
  driver_name,
  car_name,
  best_lap_ms,
  best_lap_number,
  penalties,
  lap_count,
  session_date,
  coalesce(user_id = (select auth.uid()), false) as mine
from public.lap_records
order by track_id, user_id, lower(driver_name), best_lap_ms, session_date;
