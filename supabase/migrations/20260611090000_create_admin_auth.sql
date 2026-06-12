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
  role public.admin_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users
  add column if not exists login_id text;

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

alter table public.admin_users
  alter column login_id set not null;

create unique index if not exists admin_users_login_id_idx
  on public.admin_users (login_id);

drop trigger if exists set_admin_users_updated_at on public.admin_users;
create trigger set_admin_users_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = coalesce(check_user_id, auth.uid())
      and role = 'admin'
  );
$$;

alter table public.admin_users enable row level security;

drop policy if exists "Admin users can read their own role" on public.admin_users;
drop policy if exists "Admins manage admin users" on public.admin_users;

create policy "Admin users can read their own role"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Admins manage admin users"
  on public.admin_users for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "Authenticated users manage books" on public.books;
drop policy if exists "Authenticated users manage students" on public.students;
drop policy if exists "Authenticated users manage loans" on public.loans;
drop policy if exists "Authenticated users manage book requests" on public.book_requests;
drop policy if exists "Admins manage books" on public.books;
drop policy if exists "Admins manage students" on public.students;
drop policy if exists "Admins manage loans" on public.loans;
drop policy if exists "Admins manage book requests" on public.book_requests;

create policy "Admins manage books"
  on public.books for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Admins manage students"
  on public.students for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Admins manage loans"
  on public.loans for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Admins manage book requests"
  on public.book_requests for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

grant select, insert, update, delete on public.admin_users to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
