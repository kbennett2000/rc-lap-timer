-- Driver profiles (supabase/migrations/*_profiles.sql): each driver's best lap at each track, their place there, and
-- what's shown of who posted them. Run with the local Supabase up:
--   npx supabase@2.119.0 test db
-- It looks only at its own tracks, so it passes on a database the browser tests have used too.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com');

create function pg_temp.sign_in(id uuid) returns void language plpgsql as $$
begin
  if id is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end;
$$;
grant execute on function pg_temp.sign_in(uuid) to anon, authenticated;

create function pg_temp.post(track uuid, session uuid, driver text, best integer) returns void language sql as $$
  insert into public.lap_records
    (track_id, session_id, driver_name, car_name, best_lap_ms, best_lap_number, lap_count, session_date)
  values (track, session, driver, 'Slash', best, 1, 5, '2026-09-30T12:00:00Z');
$$;
grant execute on function pg_temp.post(uuid, uuid, text, integer) to anon, authenticated;

-- A's Amy at two tracks (twice at the first), and B's own Amy at the first.
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000a');
insert into public.tracks (id, name) values
  ('30000000-0000-4000-8000-000000000001', 'Profile Oval'),
  ('30000000-0000-4000-8000-000000000002', 'Profile Garage');
select pg_temp.post('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Amy', 12000);
select pg_temp.post('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'amy', 11000);
select pg_temp.post('30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', 'Amy', 9000);
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000b');
select pg_temp.post('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 'Amy', 10000);

create temp view test_bests as
  select * from public.driver_bests where track_id::text like '30000000-%';
grant select on test_bests to anon, authenticated;

-- Signed out, as anyone sees it.
select pg_temp.sign_in(null);
select is((select count(distinct driver_key) from test_bests), 2::bigint,
  'two drivers: the same name from two accounts is two drivers');
select is(
  (select array_agg(track_name || ':' || best_lap_ms || ':' || place || '/' || drivers || ':' || posts
    order by track_name)
    from test_bests where driver_key = md5('00000000-0000-4000-8000-00000000000a:amy')),
  array['Profile Garage:9000:1/1:1', 'Profile Oval:11000:2/2:2'],
  'A''s Amy: the best lap at each track, the place there, and the sessions posted'
);
select is((select place from test_bests where driver_key = md5('00000000-0000-4000-8000-00000000000b:amy')),
  1::bigint, 'B''s Amy holds the Oval''s record');
select is(
  (select array_agg(distinct l.driver_key) from public.leaderboard l
    where l.track_id = '30000000-0000-4000-8000-000000000001'),
  (select array_agg(distinct driver_key) from test_bests where track_id = '30000000-0000-4000-8000-000000000001'),
  'the leaderboard and the profiles name drivers the same way'
);
select is((select bool_or(mine) from test_bests), false, 'signed out, nothing is "mine"');
select throws_ok($$ insert into public.lap_records (track_id, session_id, driver_name, car_name, best_lap_ms,
    best_lap_number, lap_count, session_date)
  values ('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000009', 'Anon', 'Slash', 1, 1, 1, now()) $$,
  '42501', null, 'signed out, nothing can be posted');

-- Neither view shows who posted.
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.columns
    where table_schema = 'public' and table_name in ('driver_bests', 'leaderboard')
      and column_name in ('user_id', 'email', 'created_by')),
  null,
  'no account ids or emails in the views'
);

-- Signed in, a driver's own rows are "mine".
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000a');
select is((select array_agg(distinct driver_key) from test_bests where mine),
  array[md5('00000000-0000-4000-8000-00000000000a:amy')], 'A''s drivers are A''s');
select is((select bool_and(mine) from public.leaderboard where driver_key = md5('00000000-0000-4000-8000-00000000000a:amy')),
  true, 'A''s rows on the leaderboard are A''s');

-- Taking a post down moves the profile on.
delete from public.lap_records where session_id = '40000000-0000-4000-8000-000000000002';
select is((select best_lap_ms from test_bests
    where driver_key = md5('00000000-0000-4000-8000-00000000000a:amy') and track_name = 'Profile Oval'),
  12000, 'without the faster post, the next best');
select is((select posts from test_bests
    where driver_key = md5('00000000-0000-4000-8000-00000000000a:amy') and track_name = 'Profile Oval'),
  1::bigint, 'and one session posted there');

select * from finish();
rollback;
