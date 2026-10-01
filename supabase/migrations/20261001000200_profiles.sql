-- Driver profiles (docs/cloud.md): each driver's best lap at every track they've posted on, built only from the
-- public posts. A driver is a driver name as posted by one account, and driver_key names that pair without showing the
-- account.

-- The leaderboard, now with each row's driver_key (added last, so the view's other columns stay as they were).
create or replace view public.leaderboard with (security_invoker = true) as
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
  coalesce(user_id = (select auth.uid()), false) as mine,
  md5(user_id::text || ':' || lower(driver_name)) as driver_key
from public.lap_records
order by track_id, user_id, lower(driver_name), best_lap_ms, session_date;

-- A driver's best lap at each track: with its car, its place on that track's leaderboard (ranked as the app ranks it:
-- fastest first, the earlier session on a tie) out of how many drivers, and how many of the driver's sessions are
-- posted there.
create view public.driver_bests with (security_invoker = true) as
select
  best.driver_key,
  best.driver_name,
  best.car_name,
  best.track_id,
  t.name as track_name,
  t.area as track_area,
  best.best_lap_ms,
  best.session_date,
  best.mine,
  (select count(*) from public.leaderboard l
    where l.track_id = best.track_id
      and (l.best_lap_ms < best.best_lap_ms
        or (l.best_lap_ms = best.best_lap_ms and l.session_date < best.session_date))) + 1 as place,
  (select count(*) from public.leaderboard l where l.track_id = best.track_id) as drivers,
  (select count(*) from public.lap_records r
    where md5(r.user_id::text || ':' || lower(r.driver_name)) = best.driver_key
      and r.track_id = best.track_id) as posts
from public.leaderboard best
join public.tracks t on t.id = best.track_id;
