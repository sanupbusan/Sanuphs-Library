-- Existing-server repair for the default administrator account.
-- Default credentials after this script: SanupLib / SanupLib2026!
-- Change the bcrypt hash immediately after confirming access in production.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'admin_role'
  ) then
    create type public.admin_role as enum ('admin');
  end if;
end $$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text,
  password_hash text,
  role public.admin_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users
  add column if not exists login_id text;

alter table public.admin_users
  add column if not exists password_hash text;

with ranked_admins as (
  select
    user_id,
    row_number() over (order by created_at, user_id) as row_number
  from public.admin_users
  where login_id is null
)
update public.admin_users
set login_id = case
  when ranked_admins.row_number = 1 then 'SanupLib'
  else 'admin-' || replace(public.admin_users.user_id::text, '-', '')
end
from ranked_admins
where public.admin_users.user_id = ranked_admins.user_id;

update public.admin_users
set password_hash = '$2b$12$XGHuzcpNZqfBmvXo0ccVSuXj7R82ZCYfphW3vA1UTSyjzGRjaH8rq'
where password_hash is null;

alter table public.admin_users
  alter column login_id set not null;

alter table public.admin_users
  alter column password_hash set not null;

create unique index if not exists admin_users_login_id_idx
  on public.admin_users (login_id);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sanuplib') then
    grant select on public.admin_users to sanuplib;
    drop policy if exists app_login on public.admin_users;
    create policy app_login
      on public.admin_users for select
      to sanuplib
      using (true);
  end if;
end $$;

update public.admin_users
set password_hash = '$2b$12$XGHuzcpNZqfBmvXo0ccVSuXj7R82ZCYfphW3vA1UTSyjzGRjaH8rq',
    role = 'admin',
    updated_at = now()
where login_id = 'SanupLib';

insert into auth.users (id, email)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  'sanuplib-admin@sanuplib.local'
where not exists (
  select 1
  from public.admin_users
  where login_id = 'SanupLib'
)
and not exists (
  select 1
  from auth.users
  where email = 'sanuplib-admin@sanuplib.local'
)
on conflict (id) do nothing;

insert into public.admin_users (user_id, login_id, password_hash, role)
select
  coalesce(
    (
      select id
      from auth.users
      where email = 'sanuplib-admin@sanuplib.local'
      limit 1
    ),
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'SanupLib',
  '$2b$12$XGHuzcpNZqfBmvXo0ccVSuXj7R82ZCYfphW3vA1UTSyjzGRjaH8rq',
  'admin'
where not exists (
  select 1
  from public.admin_users
  where login_id = 'SanupLib'
)
on conflict (user_id) do update
set login_id = excluded.login_id,
    password_hash = excluded.password_hash,
    role = excluded.role,
    updated_at = now();

do $$
begin
  if not exists (
    select 1
    from public.admin_users
    where login_id = 'SanupLib'
      and password_hash = '$2b$12$XGHuzcpNZqfBmvXo0ccVSuXj7R82ZCYfphW3vA1UTSyjzGRjaH8rq'
      and role = 'admin'
  ) then
    raise exception 'The default administrator account could not be repaired.';
  end if;
end $$;

commit;
