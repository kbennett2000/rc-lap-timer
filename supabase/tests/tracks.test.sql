-- Who can see and change shared tracks and their leaderboards (supabase/migrations/*_tracks.sql). Run with the local
-- Supabase up:
--   npx supabase@2.119.0 test db
-- It looks only at its own tracks, so it passes on a database the browser tests have used too.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com');

-- Runs what follows as a signed-in account, or signed out (null), as the API does.
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

-- A post of a session's best lap, by whoever is signed in.
create function pg_temp.post(track uuid, session uuid, driver text, best integer) returns void language sql as $$
  insert into public.lap_records
    (track_id, session_id, driver_name, car_name, best_lap_ms, best_lap_number, lap_count, session_date)
  values (track, session, driver, 'Slash', best, 1, 5, '2026-09-30T12:00:00Z');
$$;
grant execute on function pg_temp.post(uuid, uuid, text, integer) to anon, authenticated;

-- A adds two tracks and posts on the first.
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000a');
insert into public.tracks (id, name, area) values
  ('10000000-0000-4000-8000-000000000001', 'Backyard Oval', 'Austin, TX'),
  ('10000000-0000-4000-8000-000000000002', 'Garage', '');
select throws_ok($$ insert into public.tracks (name, area) values ('backyard oval', 'austin, tx') $$, '23505', null,
  'two tracks can''t have the same name and area');
select lives_ok($$ insert into public.tracks (id, name, area)
  values ('10000000-0000-4000-8000-000000000003', 'Backyard Oval', 'Dallas, TX') $$,
  'the same name in another area is another track');
select throws_ok($$ insert into public.tracks (name) values (' Padded ') $$, '23514', null,
  'a track''s name is stored trimmed');
select throws_ok($$ insert into public.tracks (name, created_by) values ('Not mine', '00000000-0000-4000-8000-00000000000b') $$,
  '42501', null, 'nobody adds a track in someone else''s name');
select lives_ok($$ select pg_temp.post('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Amy', 12000) $$,
  'A posts a lap');
select throws_ok($$ select pg_temp.post('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Amy', 11000) $$,
  '23505', null, 'a session is posted once');
select throws_ok($$ select pg_temp.post('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000009', 'Amy', 0) $$,
  '23514', null, 'a lap takes some time');
select pg_temp.post('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'amy', 11500);
select pg_temp.post('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'Bob', 13000);

-- B: can't post as A, change A's posts or tracks, or delete a track with A's laps; posts its own.
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000b');
select throws_ok($$ insert into public.lap_records (user_id, track_id, session_id, driver_name, car_name, best_lap_ms,
    best_lap_number, lap_count, session_date)
  values ('00000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004', 'Fake', 'Slash', 1000, 1, 1, now()) $$,
  '42501', null, 'B can''t post in A''s name');
update public.lap_records set best_lap_ms = 1 where driver_name = 'Bob';
delete from public.lap_records where driver_name = 'Bob';
update public.tracks set name = 'Renamed by B' where id = '10000000-0000-4000-8000-000000000002';
delete from public.tracks where id = '10000000-0000-4000-8000-000000000002';
select is((select best_lap_ms from public.lap_records where driver_name = 'Bob'), 13000,
  'B can''t change or take down A''s posts');
select is((select name from public.tracks where id = '10000000-0000-4000-8000-000000000002'), 'Garage',
  'B can''t rename or delete A''s track');
select pg_temp.post('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 'Amy', 12500);
create temp view test_tracks as select * from public.track_list where id::text like '10000000-%';
grant select on test_tracks to anon, authenticated;
select is((select array_agg(posts order by name, area) from test_tracks), array[4, 0, 0]::bigint[],
  'the track list counts the posts');
select is((select array_agg(mine order by name, area) from test_tracks), array[false, false, false],
  'B added none of the tracks');

-- The leaderboard: one row per driver per account, its best lap, and which rows are B's.
select is(
  (select array_agg(driver_name || ':' || best_lap_ms || ':' || mine order by best_lap_ms)
    from public.leaderboard where track_id = '10000000-0000-4000-8000-000000000001'),
  array['amy:11500:false', 'Amy:12500:true', 'Bob:13000:false'],
  'each driver''s best lap, per account'
);

-- Signed out: everything can be seen, nothing changed.
select pg_temp.sign_in(null);
select is((select count(*) from public.leaderboard where track_id = '10000000-0000-4000-8000-000000000001'), 3::bigint,
  'signed out, the leaderboard can be seen');
select is((select count(*) from test_tracks), 3::bigint, 'signed out, the tracks can be seen');
select is((select bool_or(mine) from public.leaderboard), false, 'signed out, nothing is "mine"');
select throws_ok($$ insert into public.tracks (name) values ('Anon') $$, '42501', null,
  'signed out, no track can be added');
select throws_ok($$ select pg_temp.post('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000006', 'Anon', 9000) $$,
  '42501', null, 'signed out, no lap can be posted');
select throws_ok($$ delete from public.lap_records $$, '42501', null, 'signed out, no post can be taken down');

-- A: a track with B's lap on it can't be deleted; one with only A's laps can.
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000a');
delete from public.tracks where id = '10000000-0000-4000-8000-000000000001';
select is((select count(*) from public.tracks where id = '10000000-0000-4000-8000-000000000001'), 1::bigint,
  'A can''t delete a track with B''s lap on it');
select pg_temp.post('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000007', 'Amy', 9000);
delete from public.tracks where id = '10000000-0000-4000-8000-000000000002';
select is((select count(*) from public.lap_records where track_id = '10000000-0000-4000-8000-000000000002'), 0::bigint,
  'deleting a track with only A''s laps takes them with it');
update public.tracks set name = 'Backyard Loop' where id = '10000000-0000-4000-8000-000000000001';
select is((select name from public.tracks where id = '10000000-0000-4000-8000-000000000001'), 'Backyard Loop',
  'A renames its own track');

-- Deleting A's account takes its posts and keeps its tracks.
select public.delete_my_account();
reset role;
select is((select array_agg(driver_name) from public.lap_records where session_id::text like '20000000-%'), array['Amy'],
  'A''s posts went, B''s stayed');
select is((select count(*) from public.tracks where id::text like '10000000-%' and created_by is null), 2::bigint,
  'A''s tracks stayed, unowned');

select * from finish();
rollback;
