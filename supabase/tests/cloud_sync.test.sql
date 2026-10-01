-- Who can read and change cloud sync's data (supabase/migrations/*_cloud_sync.sql). Run with the local Supabase up:
--   npx supabase@2.119.0 test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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

-- A saves for the first time, then again from the version it has.
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000a');
select is(public.put_bundle('{"format":"rc-lap-timer","n":1}', 0), 1::bigint, 'the first save makes version 1');
select is(public.put_bundle('{"format":"rc-lap-timer","n":2}', 1), 2::bigint, 'saving from version 1 makes 2');
select throws_ok($$ select public.put_bundle('{"format":"rc-lap-timer","n":3}', 1) $$, 'PT409', 'conflict',
  'saving from an old version is refused');
select throws_ok($$ select public.put_bundle('{"format":"rc-lap-timer","n":3}', 0) $$, 'PT409', 'conflict',
  'a second first save is refused');
select is((select bundle ->> 'n' from public.cloud_bundles), '2', 'the refused saves changed nothing');
select throws_ok($$ select public.put_bundle('{"format":"something else"}', 2) $$, '23514', null,
  'only a bundle can be saved');

-- B can't see or change A's data, even by writing to the table directly.
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000b');
select is_empty($$ select * from public.cloud_bundles $$, 'B sees none of A''s data');
select throws_ok($$ select public.put_bundle('{"format":"rc-lap-timer"}', 2) $$, 'PT409', 'conflict',
  'B can''t save over A''s data');
update public.cloud_bundles set bundle = '{"format":"rc-lap-timer","n":"B"}'
  where user_id = '00000000-0000-4000-8000-00000000000a';
delete from public.cloud_bundles where user_id = '00000000-0000-4000-8000-00000000000a';
select throws_ok($$ insert into public.cloud_bundles (user_id, bundle, version)
  values ('00000000-0000-4000-8000-00000000000a', '{"format":"rc-lap-timer"}', 9) $$, '42501', null,
  'B can''t add data for A');
select is(public.put_bundle('{"format":"rc-lap-timer","n":"B"}', 0), 1::bigint, 'B saves its own');
select is((select count(*) from public.cloud_bundles), 1::bigint, 'B sees only its own data');

-- Signed out, nothing.
select pg_temp.sign_in(null);
select throws_ok($$ select * from public.cloud_bundles $$, '42501', null, 'signed out, the data can''t be read');
select throws_ok($$ select public.put_bundle('{"format":"rc-lap-timer"}', 0) $$, '42501', null,
  'signed out, nothing can be saved');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'signed out, no account can be deleted');

-- A's data survived B, and deleting A's account takes it with it, and only it.
select pg_temp.sign_in('00000000-0000-4000-8000-00000000000a');
select is((select bundle ->> 'n' from public.cloud_bundles), '2', 'B''s update and delete changed nothing of A''s');
select public.delete_my_account();
reset role;
select is((select count(*) from auth.users where email = 'a@example.com'), 0::bigint, 'A''s account is gone');
select is(
  (select array_agg(bundle ->> 'n') from public.cloud_bundles
    where user_id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b')),
  array['B'],
  'A''s data went with it, and B''s is still there'
);

select * from finish();
rollback;
