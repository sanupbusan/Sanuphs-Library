create type public.admin_role as enum ('admin');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique,
  role public.admin_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_admin_users_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

create function public.is_admin(check_user_id uuid default auth.uid())
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
