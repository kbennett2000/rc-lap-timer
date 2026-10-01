-- Cloud sync (docs/cloud.md). Each account's data is kept as one sync bundle, the same format as a backup file
-- (src/domain/sync/bundle.ts). The phone app merges it with its own (src/cloud/sync.ts) and saves the result with
-- put_bundle, which refuses it if another phone saved first. Only the account's owner can read or change it.

create table public.cloud_bundles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bundle jsonb not null,
  -- Goes up by one with every save.
  version bigint not null check (version > 0),
  updated_at timestamptz not null default now(),
  constraint cloud_bundles_is_a_bundle check (bundle ->> 'format' = 'rc-lap-timer'),
  -- 25 MB: years of sessions are a few MB.
  constraint cloud_bundles_size check (octet_length(bundle::text) <= 26214400)
);

alter table public.cloud_bundles enable row level security;

create policy "Owners read their data" on public.cloud_bundles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners add their data" on public.cloud_bundles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners change their data" on public.cloud_bundles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners delete their data" on public.cloud_bundles
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.cloud_bundles from anon;

-- Saves the signed-in account's bundle, if it's still at p_version (0: there's none yet), and returns the new
-- version. Otherwise it fails with PT409 (PostgREST answers 409), and the phone reads it again and merges.
create function public.put_bundle(p_bundle jsonb, p_version bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved bigint;
begin
  if p_version = 0 then
    insert into public.cloud_bundles (user_id, bundle, version)
    values ((select auth.uid()), p_bundle, 1)
    on conflict (user_id) do nothing
    returning version into saved;
  else
    update public.cloud_bundles
    set bundle = p_bundle, version = version + 1, updated_at = now()
    where user_id = (select auth.uid()) and version = p_version
    returning version into saved;
  end if;
  if saved is null then
    raise sqlstate 'PT409' using message = 'conflict',
      hint = 'Another device saved first: read the data again and merge.';
  end if;
  return saved;
end;
$$;

revoke execute on function public.put_bundle(jsonb, bigint) from public, anon;
grant execute on function public.put_bundle(jsonb, bigint) to authenticated;

-- Deletes the signed-in account and, through the foreign keys, everything it has in the cloud. Data on the phone
-- isn't touched.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise sqlstate 'PT401' using message = 'not signed in';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
