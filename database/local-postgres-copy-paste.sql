do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sanuplib') then
    raise exception 'Role sanuplib does not exist. Create the app DB user first.';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end
$$;

grant all privileges on database library_db to sanuplib;

create schema if not exists extensions;
create schema if not exists auth;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.gen_random_uuid()
returns uuid
language sql
volatile
as $$
  select extensions.gen_random_uuid();
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end
$$;

create table if not exists auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid;
$$;


create extension if not exists pgcrypto with schema extensions;

create type public.loan_status as enum ('rented', 'returned');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'purchased');

create table public.books (
  id uuid primary key default gen_random_uuid(),
  isbn text unique,
  title text not null,
  author text not null,
  publisher text,
  category text not null default U&'\BBF8\BD84\B958',
  published_year integer,
  total_copies integer not null default 1 check (total_copies >= 0),
  available_copies integer not null default 1 check (available_copies >= 0),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_available_not_over_total check (available_copies <= total_copies)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  student_number text not null unique,
  name text not null,
  grade smallint not null check (grade between 1 and 3),
  class_number smallint not null check (class_number > 0),
  seat_number smallint not null check (seat_number > 0),
  email text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  borrowed_on date not null default current_date,
  due_on date not null default (current_date + 14),
  returned_on date,
  status public.loan_status not null default 'rented',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loans_due_after_borrowed check (due_on >= borrowed_on),
  constraint loans_returned_after_borrowed check (returned_on is null or returned_on >= borrowed_on),
  constraint loans_status_matches_return_date check (
    (status = 'rented' and returned_on is null)
    or (status = 'returned' and returned_on is not null)
  )
);

create table public.book_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  requester_name text not null,
  title text not null,
  author text,
  reason text,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index books_title_idx on public.books using gin (to_tsvector('simple', title));
create index books_author_idx on public.books (author);
create index loans_book_id_idx on public.loans (book_id);
create index loans_student_id_idx on public.loans (student_id);
create index loans_due_on_idx on public.loans (due_on) where status = 'rented';
create unique index loans_one_active_book_per_student_idx
  on public.loans (book_id, student_id)
  where status = 'rented';

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

create trigger set_students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

create trigger set_loans_updated_at
  before update on public.loans
  for each row execute function public.set_updated_at();

create trigger set_book_requests_updated_at
  before update on public.book_requests
  for each row execute function public.set_updated_at();

create view public.dashboard_summary
with (security_invoker = true)
as
select
  count(*)::integer as total_books,
  coalesce(sum(total_copies), 0)::integer as total_copies,
  coalesce(sum(available_copies), 0)::integer as available_copies,
  (
    select count(*)::integer
    from public.loans
    where status = 'rented'
  ) as active_loans,
  (
    select count(*)::integer
    from public.loans
    where status = 'rented'
      and due_on < current_date
  ) as overdue_loans
from public.books;

create view public.dashboard_recent_loans
with (security_invoker = true)
as
select
  loans.id,
  students.name as student_name,
  books.title as book_title,
  loans.borrowed_on as rental_date,
  loans.due_on as return_date,
  case
    when loans.status = 'returned' then 'returned'
    when loans.due_on < current_date then 'overdue'
    else 'rented'
  end as status
from public.loans
join public.students on students.id = loans.student_id
join public.books on books.id = loans.book_id
order by loans.borrowed_on desc, loans.created_at desc
limit 20;

create function public.search_books(search_query text default '')
returns table (
  id uuid,
  isbn text,
  title text,
  author text,
  publisher text,
  category text,
  available_copies integer,
  total_copies integer,
  location text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    books.id,
    books.isbn,
    books.title,
    books.author,
    books.publisher,
    books.category,
    books.available_copies,
    books.total_copies,
    books.location
  from public.books
  where nullif(trim(search_query), '') is null
     or books.title ilike '%' || trim(search_query) || '%'
     or books.author ilike '%' || trim(search_query) || '%'
     or books.category ilike '%' || trim(search_query) || '%'
  order by books.title;
$$;

alter table public.books enable row level security;
alter table public.students enable row level security;
alter table public.loans enable row level security;
alter table public.book_requests enable row level security;

create policy "Books are searchable by everyone"
  on public.books for select
  to anon, authenticated
  using (true);

create policy "Authenticated users manage books"
  on public.books for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users manage students"
  on public.students for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users manage loans"
  on public.loans for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users manage book requests"
  on public.book_requests for all
  to authenticated
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.books to anon, authenticated;
grant select, insert, update, delete on public.books to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.loans to authenticated;
grant select, insert, update, delete on public.book_requests to authenticated;
grant select on public.dashboard_summary to authenticated;
grant select on public.dashboard_recent_loans to authenticated;
grant execute on function public.search_books(text) to anon, authenticated;


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


alter table public.books
  add column if not exists school_book_code text;

create unique index if not exists books_school_book_code_idx
  on public.books (school_book_code)
  where school_book_code is not null;


create or replace function public.search_books(search_query text default '')
returns table (
  id uuid,
  isbn text,
  title text,
  author text,
  publisher text,
  category text,
  available_copies integer,
  total_copies integer,
  location text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    books.id,
    books.isbn,
    books.title,
    books.author,
    books.publisher,
    books.category,
    books.available_copies,
    books.total_copies,
    books.location
  from public.books
  where nullif(trim(search_query), '') is null
     or books.title ilike '%' || trim(search_query) || '%'
     or books.author ilike '%' || trim(search_query) || '%'
  order by books.title;
$$;


create or replace function public.get_returnable_loan_by_school_book_code(input_school_book_code text)
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  borrowed_on date,
  due_on date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    loans.id as loan_id,
    books.school_book_code,
    books.title as book_title,
    students.name as student_name,
    loans.borrowed_on,
    loans.due_on
  from public.loans
  join public.books on books.id = loans.book_id
  join public.students on students.id = loans.student_id
  where books.school_book_code = nullif(trim(input_school_book_code), '')
    and loans.status = 'rented'
    and loans.returned_on is null
  limit 1;
$$;

create or replace function public.return_loans_by_school_book_codes(input_school_book_codes text[])
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  returned_on date
)
language sql
volatile
security definer
set search_path = public
as $$
  with normalized_codes as (
    select distinct nullif(trim(code), '') as school_book_code
    from unnest(input_school_book_codes) as code
    where nullif(trim(code), '') is not null
  ),
  target_loans as (
    select
      loans.id,
      loans.book_id,
      books.school_book_code,
      books.title as book_title,
      students.name as student_name
    from public.loans
    join public.books on books.id = loans.book_id
    join public.students on students.id = loans.student_id
    join normalized_codes on normalized_codes.school_book_code = books.school_book_code
    where loans.status = 'rented'
      and loans.returned_on is null
    for update of loans
  ),
  updated_loans as (
    update public.loans
    set
      status = 'returned',
      returned_on = current_date
    where loans.id in (select target_loans.id from target_loans)
    returning loans.id, loans.book_id, loans.returned_on
  ),
  returned_book_counts as (
    select updated_loans.book_id, count(*)::integer as returned_count
    from updated_loans
    group by updated_loans.book_id
  ),
  updated_books as (
    update public.books
    set available_copies = least(books.total_copies, books.available_copies + returned_book_counts.returned_count)
    from returned_book_counts
    where books.id = returned_book_counts.book_id
    returning books.id
  )
  select
    updated_loans.id as loan_id,
    target_loans.school_book_code,
    target_loans.book_title,
    target_loans.student_name,
    updated_loans.returned_on
  from updated_loans
  join target_loans on target_loans.id = updated_loans.id
  order by target_loans.school_book_code;
$$;

grant execute on function public.get_returnable_loan_by_school_book_code(text) to anon, authenticated;
grant execute on function public.return_loans_by_school_book_codes(text[]) to anon, authenticated;


insert into public.students (student_number, name, grade, class_number, seat_number)
select
  '3' || lpad(class_num::text, 2, '0') || lpad(seat_num::text, 2, '0'),
  U&'\D559\C0DD' || ('3' || lpad(class_num::text, 2, '0') || lpad(seat_num::text, 2, '0')),
  3,
  class_num,
  seat_num
from generate_series(1, 10) as class_num,
     generate_series(1, 20) as seat_num
on conflict (student_number) do nothing;

insert into public.students (student_number, name, grade, class_number, seat_number)
select
  'T' || lpad(num::text, 2, '0'),
  U&'\AD50\C9C1\C6D0' || lpad(num::text, 2, '0'),
  3,
  99,
  num
from generate_series(1, 30) as num
on conflict (student_number) do nothing;


insert into public.students (student_number, name, grade, class_number, seat_number)
select
  '3' || lpad(class_num::text, 2, '0') || lpad(seat_num::text, 2, '0'),
  U&'\D559\C0DD' || ('3' || lpad(class_num::text, 2, '0') || lpad(seat_num::text, 2, '0')),
  3,
  class_num,
  seat_num
from generate_series(1, 10) as class_num,
     generate_series(1, 20) as seat_num
on conflict (student_number) do nothing;

insert into public.students (student_number, name, grade, class_number, seat_number)
select
  'T' || lpad(num::text, 2, '0'),
  U&'\AD50\C9C1\C6D0' || lpad(num::text, 2, '0'),
  3,
  99,
  num
from generate_series(1, 30) as num
on conflict (student_number) do nothing;


create or replace function public.sync_book_available_copies()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'rented') then
    update public.books
    set available_copies = available_copies - 1
    where id = NEW.book_id;
  elsif (TG_OP = 'UPDATE') then
    if (OLD.status = 'rented' and NEW.status = 'returned') then
      update public.books
      set available_copies = available_copies + 1
      where id = NEW.book_id;
    elsif (OLD.status = 'returned' and NEW.status = 'rented') then
      update public.books
      set available_copies = available_copies - 1
      where id = NEW.book_id;
    end if;
  elsif (TG_OP = 'DELETE' and OLD.status = 'rented') then
    update public.books
    set available_copies = available_copies + 1
    where id = OLD.book_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

create trigger sync_book_available_copies_on_loan_change
  after insert or update or delete on public.loans
  for each row execute function public.sync_book_available_copies();


update public.books
set available_copies = (
  select count(*)
  from public.loans
  where loans.book_id = books.id
    and loans.status = 'rented'
)
where exists (
  select 1 from public.loans where loans.book_id = books.id
);


alter table public.loans
  drop constraint if exists loans_book_id_fkey;

alter table public.loans
  add constraint loans_book_id_fkey
    foreign key (book_id) references public.books(id)
    on delete cascade;


with rented_counts as (
  select
    books.id as book_id,
    count(loans.id) filter (where loans.status = 'rented')::integer as rented_count
  from public.books
  left join public.loans on loans.book_id = books.id
  group by books.id
)
update public.books
set available_copies = greatest(books.total_copies - rented_counts.rented_count, 0)
from rented_counts
where books.id = rented_counts.book_id;


create or replace function public.return_loans_by_school_book_codes(input_school_book_codes text[])
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  returned_on date
)
language sql
volatile
security definer
set search_path = public
as $$
  with normalized_codes as (
    select distinct nullif(trim(code), '') as school_book_code
    from unnest(input_school_book_codes) as code
    where nullif(trim(code), '') is not null
  ),
  target_loans as (
    select
      loans.id,
      books.school_book_code,
      books.title as book_title,
      students.name as student_name
    from public.loans
    join public.books on books.id = loans.book_id
    join public.students on students.id = loans.student_id
    join normalized_codes on normalized_codes.school_book_code = books.school_book_code
    where loans.status = 'rented'
      and loans.returned_on is null
    for update of loans
  ),
  updated_loans as (
    update public.loans
    set
      status = 'returned',
      returned_on = current_date
    where loans.id in (select target_loans.id from target_loans)
    returning loans.id, loans.returned_on
  )
  select
    updated_loans.id as loan_id,
    target_loans.school_book_code,
    target_loans.book_title,
    target_loans.student_name,
    updated_loans.returned_on
  from updated_loans
  join target_loans on target_loans.id = updated_loans.id
  order by target_loans.school_book_code;
$$;

grant execute on function public.return_loans_by_school_book_codes(text[]) to anon, authenticated;


alter table public.students
  add column if not exists loan_banned_until date;

create index if not exists students_loan_banned_until_idx
  on public.students (loan_banned_until)
  where loan_banned_until is not null;

comment on column public.students.loan_banned_until is 'Last date the student cannot borrow books due to overdue returns.';

drop function if exists public.return_loans_by_school_book_codes(text[]);

create or replace function public.return_loans_by_school_book_codes(input_school_book_codes text[])
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  returned_on date,
  overdue_days integer,
  loan_banned_until date
)
language sql
volatile
security definer
set search_path = public
as $$
  with normalized_codes as (
    select distinct nullif(trim(code), '') as school_book_code
    from unnest(input_school_book_codes) as code
    where nullif(trim(code), '') is not null
  ),
  target_loans as (
    select
      loans.id,
      books.school_book_code,
      books.title as book_title,
      students.id as student_id,
      students.name as student_name,
      students.loan_banned_until as previous_loan_banned_until
    from public.loans
    join public.books on books.id = loans.book_id
    join public.students on students.id = loans.student_id
    join normalized_codes on normalized_codes.school_book_code = books.school_book_code
    where loans.status = 'rented'
      and loans.returned_on is null
    for update of loans
  ),
  updated_loans as (
    update public.loans
    set
      status = 'returned',
      returned_on = current_date
    where loans.id in (select target_loans.id from target_loans)
    returning loans.id, loans.student_id, loans.due_on, loans.returned_on
  ),
  returned_details as (
    select
      updated_loans.id,
      updated_loans.student_id,
      updated_loans.returned_on,
      greatest((updated_loans.returned_on - updated_loans.due_on)::integer, 0) as overdue_days,
      case
        when updated_loans.returned_on > updated_loans.due_on then
          updated_loans.returned_on + ((updated_loans.returned_on - updated_loans.due_on)::integer)
        else null
      end as new_loan_banned_until
    from updated_loans
  ),
  student_bans as (
    select
      returned_details.student_id,
      max(returned_details.new_loan_banned_until) as new_loan_banned_until
    from returned_details
    where returned_details.new_loan_banned_until is not null
    group by returned_details.student_id
  ),
  updated_students as (
    update public.students
    set loan_banned_until = case
      when students.loan_banned_until is null
        or students.loan_banned_until < student_bans.new_loan_banned_until
        then student_bans.new_loan_banned_until
      else students.loan_banned_until
    end
    from student_bans
    where students.id = student_bans.student_id
    returning students.id, students.loan_banned_until
  )
  select
    updated_loans.id as loan_id,
    target_loans.school_book_code,
    target_loans.book_title,
    target_loans.student_name,
    updated_loans.returned_on,
    returned_details.overdue_days,
    coalesce(updated_students.loan_banned_until, target_loans.previous_loan_banned_until) as loan_banned_until
  from updated_loans
  join target_loans on target_loans.id = updated_loans.id
  join returned_details on returned_details.id = updated_loans.id
  left join updated_students on updated_students.id = updated_loans.student_id
  order by target_loans.school_book_code;
$$;

grant execute on function public.return_loans_by_school_book_codes(text[]) to anon, authenticated;


create or replace function public.sync_book_available_copies()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affected_book_id uuid;
begin
  if (TG_OP = 'DELETE') then
    affected_book_id := OLD.book_id;
  else
    affected_book_id := NEW.book_id;
  end if;

  update public.books
  set available_copies = greatest(
    total_copies - (
      select count(*)::integer
      from public.loans
      where loans.book_id = affected_book_id
        and loans.status = 'rented'
    ),
    0
  )
  where books.id = affected_book_id;

  if (TG_OP = 'UPDATE' and OLD.book_id is distinct from NEW.book_id) then
    update public.books
    set available_copies = greatest(
      total_copies - (
        select count(*)::integer
        from public.loans
        where loans.book_id = OLD.book_id
          and loans.status = 'rented'
      ),
      0
    )
    where books.id = OLD.book_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists sync_book_available_copies_on_loan_change on public.loans;

create trigger sync_book_available_copies_on_loan_change
  after insert or update or delete on public.loans
  for each row execute function public.sync_book_available_copies();

with rented_counts as (
  select
    books.id as book_id,
    count(loans.id) filter (where loans.status = 'rented')::integer as rented_count
  from public.books
  left join public.loans on loans.book_id = books.id
  group by books.id
)
update public.books
set available_copies = greatest(books.total_copies - rented_counts.rented_count, 0)
from rented_counts
where books.id = rented_counts.book_id;


create or replace function public.get_borrower_loan_limit(
  input_student_number text,
  input_class_number smallint
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(input_student_number, '') ~* '^T[0-9]{2}$'
      or input_class_number = 99 then 5
    else 2
  end;
$$;

create or replace function public.enforce_borrower_loan_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_loan_count integer;
  borrower record;
  borrower_label text;
  loan_limit integer;
begin
  if NEW.status <> 'rented' or NEW.returned_on is not null then
    return NEW;
  end if;

  select students.student_number, students.class_number
  into borrower
  from public.students
  where students.id = NEW.student_id;

  if not found then
    return NEW;
  end if;

  loan_limit := public.get_borrower_loan_limit(
    borrower.student_number,
    borrower.class_number
  );
  borrower_label := case when loan_limit = 5 then U&'\AD50\C9C1\C6D0' else U&'\D559\C0DD' end;

  select count(*)::integer
  into active_loan_count
  from public.loans
  where loans.student_id = NEW.student_id
    and loans.status = 'rented'
    and loans.returned_on is null
    and loans.id is distinct from NEW.id;

  if active_loan_count >= loan_limit then
    raise exception using
      errcode = '23514',
      message = borrower_label || U&'\C740 \CD5C\B300 ' || loan_limit || U&'\AD8C\AE4C\C9C0 \B300\C5EC\D560 \C218 \C788\C2B5\B2C8\B2E4.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_borrower_loan_limit_on_loan_change on public.loans;

create trigger enforce_borrower_loan_limit_on_loan_change
  before insert or update of student_id, status, returned_on on public.loans
  for each row execute function public.enforce_borrower_loan_limit();

grant execute on function public.get_borrower_loan_limit(text, smallint) to authenticated;


create or replace function public.lookup_student_for_loan(input_student_number text)
returns table (
  id uuid,
  student_number text,
  name text,
  grade smallint,
  class_number smallint,
  seat_number smallint,
  active_loan_count integer,
  borrower_type text,
  borrower_label text,
  loan_limit integer,
  remaining_loan_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with target_student as (
    select
      students.id,
      students.student_number,
      students.name,
      students.grade,
      students.class_number,
      students.seat_number,
      public.get_borrower_loan_limit(students.student_number, students.class_number) as loan_limit
    from public.students
    where students.student_number = nullif(trim(input_student_number), '')
  ),
  active_counts as (
    select
      target_student.id,
      count(loans.id) filter (
        where loans.status = 'rented'
          and loans.returned_on is null
      )::integer as active_loan_count
    from target_student
    left join public.loans on loans.student_id = target_student.id
    group by target_student.id
  )
  select
    target_student.id,
    target_student.student_number,
    target_student.name,
    target_student.grade,
    target_student.class_number,
    target_student.seat_number,
    coalesce(active_counts.active_loan_count, 0) as active_loan_count,
    case when target_student.loan_limit = 5 then 'staff' else 'student' end as borrower_type,
    case when target_student.loan_limit = 5 then U&'\AD50\C9C1\C6D0' else U&'\D559\C0DD' end as borrower_label,
    target_student.loan_limit,
    greatest(target_student.loan_limit - coalesce(active_counts.active_loan_count, 0), 0) as remaining_loan_count
  from target_student
  left join active_counts on active_counts.id = target_student.id;
$$;

create or replace function public.create_public_loan(
  input_book_id uuid,
  input_student_id uuid,
  input_notes text default null
)
returns table (
  book_title text,
  active_loan_count integer,
  borrower_label text,
  borrower_type text,
  due_on date,
  loan_id uuid,
  loan_limit integer,
  remaining_loan_count integer,
  student_name text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_active_loan_count integer;
  v_book record;
  v_borrower_label text;
  v_borrower_type text;
  v_loan record;
  v_loan_limit integer;
  v_student record;
begin
  select books.id, books.title, books.available_copies
  into v_book
  from public.books
  where books.id = input_book_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOK_NOT_FOUND';
  end if;

  if v_book.available_copies <= 0 then
    raise exception using errcode = 'P0001', message = 'NO_AVAILABLE_COPIES';
  end if;

  select students.id, students.name, students.student_number, students.class_number
  into v_student
  from public.students
  where students.id = input_student_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'STUDENT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.loans
    where loans.book_id = input_book_id
      and loans.student_id = input_student_id
      and loans.status = 'rented'
      and loans.returned_on is null
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_RENTED';
  end if;

  select count(*)::integer
  into v_active_loan_count
  from public.loans
  where loans.student_id = input_student_id
    and loans.status = 'rented'
    and loans.returned_on is null;

  v_loan_limit := public.get_borrower_loan_limit(v_student.student_number, v_student.class_number);
  v_borrower_type := case when v_loan_limit = 5 then 'staff' else 'student' end;
  v_borrower_label := case when v_loan_limit = 5 then U&'\AD50\C9C1\C6D0' else U&'\D559\C0DD' end;

  if v_active_loan_count >= v_loan_limit then
    raise exception using
      errcode = '23514',
      message = v_borrower_label || U&'\C740 \CD5C\B300 ' || v_loan_limit || U&'\AD8C\AE4C\C9C0 \B300\C5EC\D560 \C218 \C788\C2B5\B2C8\B2E4. \D604\C7AC ' || v_active_loan_count || U&'\AD8C \B300\C5EC \C911\C785\B2C8\B2E4.';
  end if;

  insert into public.loans (book_id, student_id, notes)
  values (input_book_id, input_student_id, nullif(trim(input_notes), ''))
  returning id, due_on
  into v_loan;

  return query
  select
    v_book.title::text as book_title,
    (v_active_loan_count + 1)::integer as active_loan_count,
    v_borrower_label::text as borrower_label,
    v_borrower_type::text as borrower_type,
    v_loan.due_on::date as due_on,
    v_loan.id::uuid as loan_id,
    v_loan_limit::integer as loan_limit,
    greatest(v_loan_limit - v_active_loan_count - 1, 0)::integer as remaining_loan_count,
    v_student.name::text as student_name;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ALREADY_RENTED';
end;
$$;

grant execute on function public.get_borrower_loan_limit(text, smallint) to anon, authenticated;
grant execute on function public.lookup_student_for_loan(text) to anon, authenticated;
grant execute on function public.create_public_loan(uuid, uuid, text) to anon, authenticated;


do $$
declare
  trigger_to_remove record;
begin
  for trigger_to_remove in
    select loan_triggers.tgname as trigger_name
    from pg_trigger loan_triggers
    join pg_class loan_table on loan_table.oid = loan_triggers.tgrelid
    join pg_namespace loan_schema on loan_schema.oid = loan_table.relnamespace
    join pg_proc trigger_function on trigger_function.oid = loan_triggers.tgfoid
    where loan_schema.nspname = 'public'
      and loan_table.relname = 'loans'
      and not loan_triggers.tgisinternal
      and loan_triggers.tgname not in (
        'set_loans_updated_at',
        'sync_book_available_copies_on_loan_change',
        'enforce_borrower_loan_limit_on_loan_change'
      )
      and pg_get_functiondef(trigger_function.oid) ~* '\mdue_on\M'
  loop
    execute format('drop trigger if exists %I on public.loans', trigger_to_remove.trigger_name);
  end loop;
end;
$$;

create or replace function public.sync_book_available_copies()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affected_book_id uuid;
begin
  if (TG_OP = 'DELETE') then
    affected_book_id := OLD.book_id;
  else
    affected_book_id := NEW.book_id;
  end if;

  update public.books
  set available_copies = greatest(
    public.books.total_copies - (
      select count(*)::integer
      from public.loans
      where public.loans.book_id = affected_book_id
        and public.loans.status = 'rented'
    ),
    0
  )
  where public.books.id = affected_book_id;

  if (TG_OP = 'UPDATE' and OLD.book_id is distinct from NEW.book_id) then
    update public.books
    set available_copies = greatest(
      public.books.total_copies - (
        select count(*)::integer
        from public.loans
        where public.loans.book_id = OLD.book_id
          and public.loans.status = 'rented'
      ),
      0
    )
    where public.books.id = OLD.book_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists sync_book_available_copies_on_loan_change on public.loans;

create trigger sync_book_available_copies_on_loan_change
  after insert or update or delete on public.loans
  for each row execute function public.sync_book_available_copies();

create or replace function public.enforce_borrower_loan_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_loan_count integer;
  borrower record;
  borrower_label text;
  borrower_loan_limit integer;
begin
  if NEW.status <> 'rented' or NEW.returned_on is not null then
    return NEW;
  end if;

  select public.students.student_number, public.students.class_number
  into borrower
  from public.students
  where public.students.id = NEW.student_id;

  if not found then
    return NEW;
  end if;

  borrower_loan_limit := public.get_borrower_loan_limit(
    borrower.student_number,
    borrower.class_number
  );
  borrower_label := case when borrower_loan_limit = 5 then U&'\AD50\C9C1\C6D0' else U&'\D559\C0DD' end;

  select count(*)::integer
  into active_loan_count
  from public.loans
  where public.loans.student_id = NEW.student_id
    and public.loans.status = 'rented'
    and public.loans.returned_on is null
    and public.loans.id is distinct from NEW.id;

  if active_loan_count >= borrower_loan_limit then
    raise exception using
      errcode = '23514',
      message = borrower_label || U&'\C740 \CD5C\B300 ' || borrower_loan_limit || U&'\AD8C\AE4C\C9C0 \B300\C5EC\D560 \C218 \C788\C2B5\B2C8\B2E4.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_borrower_loan_limit_on_loan_change on public.loans;

create trigger enforce_borrower_loan_limit_on_loan_change
  before insert or update of student_id, status, returned_on on public.loans
  for each row execute function public.enforce_borrower_loan_limit();

create or replace view public.dashboard_summary
with (security_invoker = true)
as
select
  count(*)::integer as total_books,
  coalesce(sum(public.books.total_copies), 0)::integer as total_copies,
  coalesce(sum(public.books.available_copies), 0)::integer as available_copies,
  (
    select count(*)::integer
    from public.loans
    where public.loans.status = 'rented'
  ) as active_loans,
  (
    select count(*)::integer
    from public.loans
    where public.loans.status = 'rented'
      and public.loans.due_on < current_date
  ) as overdue_loans
from public.books;


create or replace function public.create_public_loan(
  input_book_id uuid,
  input_student_id uuid,
  input_notes text default null
)
returns table (
  book_title text,
  active_loan_count integer,
  borrower_label text,
  borrower_type text,
  due_on date,
  loan_id uuid,
  loan_limit integer,
  remaining_loan_count integer,
  student_name text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_active_loan_count integer;
  v_book record;
  v_borrower_label text;
  v_borrower_type text;
  v_due_on date;
  v_loan_id uuid;
  v_loan_limit integer;
  v_student record;
begin
  select books.id, books.title, books.available_copies
  into v_book
  from public.books
  where books.id = input_book_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOK_NOT_FOUND';
  end if;

  if v_book.available_copies <= 0 then
    raise exception using errcode = 'P0001', message = 'NO_AVAILABLE_COPIES';
  end if;

  select students.id, students.name, students.student_number, students.class_number
  into v_student
  from public.students
  where students.id = input_student_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'STUDENT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.loans
    where loans.book_id = input_book_id
      and loans.student_id = input_student_id
      and loans.status = 'rented'
      and loans.returned_on is null
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_RENTED';
  end if;

  select count(*)::integer
  into v_active_loan_count
  from public.loans
  where loans.student_id = input_student_id
    and loans.status = 'rented'
    and loans.returned_on is null;

  v_loan_limit := public.get_borrower_loan_limit(v_student.student_number, v_student.class_number);
  v_borrower_type := case when v_loan_limit = 5 then 'staff' else 'student' end;
  v_borrower_label := case when v_loan_limit = 5 then U&'\AD50\C9C1\C6D0' else U&'\D559\C0DD' end;

  if v_active_loan_count >= v_loan_limit then
    raise exception using
      errcode = '23514',
      message = v_borrower_label || U&'\C740 \CD5C\B300 ' || v_loan_limit || U&'\AD8C\AE4C\C9C0 \B300\C5EC\D560 \C218 \C788\C2B5\B2C8\B2E4. \D604\C7AC ' || v_active_loan_count || U&'\AD8C \B300\C5EC \C911\C785\B2C8\B2E4.';
  end if;

  insert into public.loans (book_id, student_id, notes)
  values (input_book_id, input_student_id, nullif(trim(input_notes), ''))
  returning public.loans.id, public.loans.due_on
  into v_loan_id, v_due_on;

  return query
  select
    v_book.title::text as book_title,
    (v_active_loan_count + 1)::integer as active_loan_count,
    v_borrower_label::text as borrower_label,
    v_borrower_type::text as borrower_type,
    v_due_on::date as due_on,
    v_loan_id::uuid as loan_id,
    v_loan_limit::integer as loan_limit,
    greatest(v_loan_limit - v_active_loan_count - 1, 0)::integer as remaining_loan_count,
    v_student.name::text as student_name;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ALREADY_RENTED';
end;
$$;

grant execute on function public.create_public_loan(uuid, uuid, text) to anon, authenticated;


drop function if exists public.lookup_student_for_loan(text);

create or replace function public.lookup_student_for_loan(input_student_number text)
returns table (
  id uuid,
  student_number text,
  name text,
  grade smallint,
  class_number smallint,
  seat_number smallint,
  active_loan_count integer,
  borrower_type text,
  borrower_label text,
  loan_limit integer,
  remaining_loan_count integer,
  overdue_days integer,
  loan_banned_until date,
  loan_ban_remaining_days integer
)
language sql
stable
security definer
set search_path = public
as $$
  with target_student as (
    select
      students.id,
      students.student_number,
      students.name,
      students.grade,
      students.class_number,
      students.seat_number,
      students.loan_banned_until,
      public.get_borrower_loan_limit(students.student_number, students.class_number) as loan_limit
    from public.students
    where students.student_number = nullif(trim(input_student_number), '')
  ),
  active_counts as (
    select
      target_student.id,
      count(loans.id) filter (
        where loans.status = 'rented'
          and loans.returned_on is null
      )::integer as active_loan_count
    from target_student
    left join public.loans on loans.student_id = target_student.id
    group by target_student.id
  ),
  first_overdue as (
    select
      target_student.id,
      min(loans.due_on) as oldest_overdue_due_on
    from target_student
    left join public.loans on loans.student_id = target_student.id
      and loans.status = 'rented'
      and loans.returned_on is null
      and loans.due_on < current_date
    group by target_student.id
  )
  select
    target_student.id,
    target_student.student_number,
    target_student.name,
    target_student.grade,
    target_student.class_number,
    target_student.seat_number,
    coalesce(active_counts.active_loan_count, 0) as active_loan_count,
    case when target_student.loan_limit = 5 then 'staff' else 'student' end as borrower_type,
    case when target_student.loan_limit = 5 then U&'\AD50\C9C1\C6D0' else U&'\D559\C0DD' end as borrower_label,
    target_student.loan_limit,
    greatest(target_student.loan_limit - coalesce(active_counts.active_loan_count, 0), 0) as remaining_loan_count,
    greatest((current_date - first_overdue.oldest_overdue_due_on)::integer, 0) as overdue_days,
    target_student.loan_banned_until,
    case
      when target_student.loan_banned_until is null or target_student.loan_banned_until < current_date
        then 0
      else (target_student.loan_banned_until - current_date)::integer + 1
    end as loan_ban_remaining_days
  from target_student
  left join active_counts on active_counts.id = target_student.id
  left join first_overdue on first_overdue.id = target_student.id;
$$;

create or replace function public.create_public_loan(
  input_book_id uuid,
  input_student_id uuid,
  input_notes text default null
)
returns table (
  book_title text,
  active_loan_count integer,
  borrower_label text,
  borrower_type text,
  due_on date,
  loan_id uuid,
  loan_limit integer,
  remaining_loan_count integer,
  student_name text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_active_loan_count integer;
  v_book record;
  v_borrower_label text;
  v_borrower_type text;
  v_loan record;
  v_loan_limit integer;
  v_student record;
  v_oldest_overdue_due_on date;
  v_today date := current_date;
begin
  select books.id, books.title, books.available_copies
  into v_book
  from public.books
  where books.id = input_book_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOK_NOT_FOUND';
  end if;

  if v_book.available_copies <= 0 then
    raise exception using errcode = 'P0001', message = 'NO_AVAILABLE_COPIES';
  end if;

  select students.id, students.name, students.student_number, students.class_number, students.loan_banned_until
  into v_student
  from public.students
  where students.id = input_student_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'STUDENT_NOT_FOUND';
  end if;

  if v_student.loan_banned_until is not null and v_student.loan_banned_until >= v_today then
    raise exception using
      errcode = 'P0001',
      message = 'STUDENT_LOAN_BANNED|' || v_student.loan_banned_until::text;
  end if;

  select min(loans.due_on)
  into v_oldest_overdue_due_on
  from public.loans
  where loans.student_id = input_student_id
    and loans.status = 'rented'
    and loans.returned_on is null
    and loans.due_on < v_today;

  if v_oldest_overdue_due_on is not null then
    raise exception using
      errcode = 'P0001',
      message = 'STUDENT_HAS_OVERDUE_LOAN|' || v_oldest_overdue_due_on::text;
  end if;

  if exists (
    select 1
    from public.loans
    where loans.book_id = input_book_id
      and loans.student_id = input_student_id
      and loans.status = 'rented'
      and loans.returned_on is null
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_RENTED';
  end if;

  select count(*)::integer
  into v_active_loan_count
  from public.loans
  where loans.student_id = input_student_id
    and loans.status = 'rented'
    and loans.returned_on is null;

  v_loan_limit := public.get_borrower_loan_limit(v_student.student_number, v_student.class_number);
  v_borrower_type := case when v_loan_limit = 5 then 'staff' else 'student' end;
  v_borrower_label := case when v_loan_limit = 5 then U&'\AD50\C9C1\C6D0' else U&'\D559\C0DD' end;

  if v_active_loan_count >= v_loan_limit then
    raise exception using
      errcode = '23514',
      message = v_borrower_label || U&'\C740 \CD5C\B300 ' || v_loan_limit || U&'\AD8C\AE4C\C9C0 \B300\C5EC\D560 \C218 \C788\C2B5\B2C8\B2E4. \D604\C7AC ' || v_active_loan_count || U&'\AD8C \B300\C5EC \C911\C785\B2C8\B2E4.';
  end if;

  insert into public.loans (book_id, student_id, notes)
  values (input_book_id, input_student_id, nullif(trim(input_notes), ''))
  returning id, due_on
  into v_loan;

  return query
  select
    v_book.title::text as book_title,
    (v_active_loan_count + 1)::integer as active_loan_count,
    v_borrower_label::text as borrower_label,
    v_borrower_type::text as borrower_type,
    v_loan.due_on::date as due_on,
    v_loan.id::uuid as loan_id,
    v_loan_limit::integer as loan_limit,
    greatest(v_loan_limit - v_active_loan_count - 1, 0)::integer as remaining_loan_count,
    v_student.name::text as student_name;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ALREADY_RENTED';
end;
$$;

grant execute on function public.lookup_student_for_loan(text) to anon, authenticated;
grant execute on function public.create_public_loan(uuid, uuid, text) to anon, authenticated;


alter table public.books
  add column if not exists school_book_codes text[] not null default '{}';

alter table public.loans
  add column if not exists school_book_code text;

update public.books
set school_book_codes = array_append(school_book_codes, school_book_code)
where school_book_code is not null
  and not school_book_code = any(school_book_codes);

create index if not exists books_school_book_codes_idx
  on public.books using gin (school_book_codes);

create unique index if not exists loans_one_active_school_book_code_idx
  on public.loans (school_book_code)
  where status = 'rented'
    and school_book_code is not null;

create or replace function public.get_returnable_loan_by_school_book_code(input_school_book_code text)
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  borrowed_on date,
  due_on date
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized_code as (
    select nullif(trim(input_school_book_code), '') as school_book_code
  )
  select
    loans.id as loan_id,
    coalesce(loans.school_book_code, books.school_book_code, normalized_code.school_book_code) as school_book_code,
    books.title as book_title,
    students.name as student_name,
    loans.borrowed_on,
    loans.due_on
  from normalized_code
  join public.loans on loans.status = 'rented'
    and loans.returned_on is null
  join public.books on books.id = loans.book_id
  join public.students on students.id = loans.student_id
  where normalized_code.school_book_code is not null
    and (
      loans.school_book_code = normalized_code.school_book_code
      or (
        loans.school_book_code is null
        and books.school_book_code = normalized_code.school_book_code
      )
    )
  limit 1;
$$;

drop function if exists public.return_loans_by_school_book_codes(text[]);

create or replace function public.return_loans_by_school_book_codes(input_school_book_codes text[])
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  returned_on date,
  overdue_days integer,
  loan_banned_until date
)
language sql
volatile
security definer
set search_path = public
as $$
  with normalized_codes as (
    select distinct nullif(trim(code), '') as school_book_code
    from unnest(input_school_book_codes) as code
    where nullif(trim(code), '') is not null
  ),
  target_loans as (
    select
      loans.id,
      coalesce(loans.school_book_code, books.school_book_code, normalized_codes.school_book_code) as school_book_code,
      books.title as book_title,
      students.id as student_id,
      students.name as student_name,
      students.loan_banned_until as previous_loan_banned_until
    from public.loans
    join public.books on books.id = loans.book_id
    join public.students on students.id = loans.student_id
    join normalized_codes on normalized_codes.school_book_code = loans.school_book_code
      or (
        loans.school_book_code is null
        and normalized_codes.school_book_code = books.school_book_code
      )
    where loans.status = 'rented'
      and loans.returned_on is null
    for update of loans
  ),
  updated_loans as (
    update public.loans
    set
      status = 'returned',
      returned_on = current_date
    where loans.id in (select target_loans.id from target_loans)
    returning loans.id, loans.student_id, loans.due_on, loans.returned_on
  ),
  returned_details as (
    select
      updated_loans.id,
      updated_loans.student_id,
      updated_loans.returned_on,
      greatest((updated_loans.returned_on - updated_loans.due_on)::integer, 0) as overdue_days,
      case
        when updated_loans.returned_on > updated_loans.due_on then
          updated_loans.returned_on + ((updated_loans.returned_on - updated_loans.due_on)::integer)
        else null
      end as new_loan_banned_until
    from updated_loans
  ),
  student_bans as (
    select
      returned_details.student_id,
      max(returned_details.new_loan_banned_until) as new_loan_banned_until
    from returned_details
    where returned_details.new_loan_banned_until is not null
    group by returned_details.student_id
  ),
  updated_students as (
    update public.students
    set loan_banned_until = case
      when students.loan_banned_until is null
        or students.loan_banned_until < student_bans.new_loan_banned_until
        then student_bans.new_loan_banned_until
      else students.loan_banned_until
    end
    from student_bans
    where students.id = student_bans.student_id
    returning students.id, students.loan_banned_until
  )
  select
    updated_loans.id as loan_id,
    target_loans.school_book_code,
    target_loans.book_title,
    target_loans.student_name,
    updated_loans.returned_on,
    returned_details.overdue_days,
    coalesce(updated_students.loan_banned_until, target_loans.previous_loan_banned_until) as loan_banned_until
  from updated_loans
  join target_loans on target_loans.id = updated_loans.id
  join returned_details on returned_details.id = updated_loans.id
  left join updated_students on updated_students.id = updated_loans.student_id
  order by target_loans.school_book_code;
$$;

grant execute on function public.get_returnable_loan_by_school_book_code(text) to anon, authenticated;
grant execute on function public.return_loans_by_school_book_codes(text[]) to anon, authenticated;


create or replace function public.get_returnable_loan_by_school_book_code(input_school_book_code text)
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  borrowed_on date,
  due_on date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    loans.id as loan_id,
    books.school_book_code,
    books.title as book_title,
    students.name as student_name,
    loans.borrowed_on,
    loans.due_on
  from public.loans
  join public.books on books.id = loans.book_id
  join public.students on students.id = loans.student_id
  where books.school_book_code = nullif(trim(input_school_book_code), '')
    and loans.status = 'rented'
    and loans.returned_on is null
  limit 1;
$$;

create or replace function public.return_loans_by_school_book_codes(input_school_book_codes text[])
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  returned_on date,
  overdue_days integer,
  loan_banned_until date
)
language sql
volatile
security definer
set search_path = public
as $$
  with normalized_codes as (
    select distinct nullif(trim(code), '') as school_book_code
    from unnest(input_school_book_codes) as code
    where nullif(trim(code), '') is not null
  ),
  target_loans as (
    select
      loans.id,
      books.school_book_code,
      books.title as book_title,
      students.id as student_id,
      students.name as student_name,
      students.loan_banned_until as previous_loan_banned_until
    from public.loans
    join public.books on books.id = loans.book_id
    join public.students on students.id = loans.student_id
    join normalized_codes on normalized_codes.school_book_code = books.school_book_code
    where loans.status = 'rented'
      and loans.returned_on is null
    for update of loans
  ),
  updated_loans as (
    update public.loans
    set
      status = 'returned',
      returned_on = current_date
    where loans.id in (select target_loans.id from target_loans)
    returning loans.id, loans.student_id, loans.due_on, loans.returned_on
  ),
  returned_details as (
    select
      updated_loans.id,
      updated_loans.student_id,
      updated_loans.returned_on,
      greatest((updated_loans.returned_on - updated_loans.due_on)::integer, 0) as overdue_days,
      case
        when updated_loans.returned_on > updated_loans.due_on then
          updated_loans.returned_on + ((updated_loans.returned_on - updated_loans.due_on)::integer)
        else null
      end as new_loan_banned_until
    from updated_loans
  ),
  student_bans as (
    select
      returned_details.student_id,
      max(returned_details.new_loan_banned_until) as new_loan_banned_until
    from returned_details
    where returned_details.new_loan_banned_until is not null
    group by returned_details.student_id
  ),
  updated_students as (
    update public.students
    set loan_banned_until = case
      when students.loan_banned_until is null
        or students.loan_banned_until < student_bans.new_loan_banned_until
        then student_bans.new_loan_banned_until
      else students.loan_banned_until
    end
    from student_bans
    where students.id = student_bans.student_id
    returning students.id, students.loan_banned_until
  )
  select
    updated_loans.id as loan_id,
    target_loans.school_book_code,
    target_loans.book_title,
    target_loans.student_name,
    updated_loans.returned_on,
    returned_details.overdue_days,
    coalesce(updated_students.loan_banned_until, target_loans.previous_loan_banned_until) as loan_banned_until
  from updated_loans
  join target_loans on target_loans.id = updated_loans.id
  join returned_details on returned_details.id = updated_loans.id
  left join updated_students on updated_students.id = updated_loans.student_id
  order by target_loans.school_book_code;
$$;

grant execute on function public.get_returnable_loan_by_school_book_code(text) to anon, authenticated;
grant execute on function public.return_loans_by_school_book_codes(text[]) to anon, authenticated;


alter table public.books
  add column if not exists school_book_codes text[] not null default '{}';

alter table public.loans
  add column if not exists school_book_code text;

update public.books
set school_book_codes = array_append(school_book_codes, school_book_code)
where school_book_code is not null
  and not school_book_code = any(school_book_codes);

create index if not exists books_school_book_codes_idx
  on public.books using gin (school_book_codes);

create unique index if not exists loans_one_active_school_book_code_idx
  on public.loans (school_book_code)
  where status = 'rented'
    and school_book_code is not null;

do $$
declare
  target_function record;
begin
  for target_function in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as function_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_returnable_loan_by_school_book_code',
        'return_loans_by_school_book_codes'
      )
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      target_function.schema_name,
      target_function.function_name,
      target_function.function_arguments
    );
  end loop;
end $$;

create function public.get_returnable_loan_by_school_book_code(input_school_book_code text)
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  borrowed_on date,
  due_on date
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized_code as (
    select nullif(trim(input_school_book_code), '') as school_book_code
  )
  select
    loans.id as loan_id,
    coalesce(loans.school_book_code, books.school_book_code, normalized_code.school_book_code) as school_book_code,
    books.title as book_title,
    students.name as student_name,
    loans.borrowed_on,
    loans.due_on
  from normalized_code
  join public.loans on loans.status = 'rented'
    and loans.returned_on is null
  join public.books on books.id = loans.book_id
  join public.students on students.id = loans.student_id
  where normalized_code.school_book_code is not null
    and (
      loans.school_book_code = normalized_code.school_book_code
      or (
        loans.school_book_code is null
        and books.school_book_code = normalized_code.school_book_code
      )
    )
  limit 1;
$$;

create function public.return_loans_by_school_book_codes(input_school_book_codes text[])
returns table (
  loan_id uuid,
  school_book_code text,
  book_title text,
  student_name text,
  returned_on date,
  overdue_days integer,
  loan_banned_until date
)
language sql
volatile
security definer
set search_path = public
as $$
  with normalized_codes as (
    select distinct nullif(trim(code), '') as school_book_code
    from unnest(input_school_book_codes) as code
    where nullif(trim(code), '') is not null
  ),
  target_loans as (
    select
      loans.id,
      coalesce(loans.school_book_code, books.school_book_code, normalized_codes.school_book_code) as school_book_code,
      books.title as book_title,
      students.id as student_id,
      students.name as student_name,
      students.loan_banned_until as previous_loan_banned_until
    from public.loans
    join public.books on books.id = loans.book_id
    join public.students on students.id = loans.student_id
    join normalized_codes on normalized_codes.school_book_code = loans.school_book_code
      or (
        loans.school_book_code is null
        and normalized_codes.school_book_code = books.school_book_code
      )
    where loans.status = 'rented'
      and loans.returned_on is null
    for update of loans
  ),
  updated_loans as (
    update public.loans
    set
      status = 'returned',
      returned_on = current_date
    where loans.id in (select target_loans.id from target_loans)
    returning loans.id, loans.student_id, loans.due_on, loans.returned_on
  ),
  returned_details as (
    select
      updated_loans.id,
      updated_loans.student_id,
      updated_loans.returned_on,
      greatest((updated_loans.returned_on - updated_loans.due_on)::integer, 0) as overdue_days,
      case
        when updated_loans.returned_on > updated_loans.due_on then
          updated_loans.returned_on + ((updated_loans.returned_on - updated_loans.due_on)::integer)
        else null
      end as new_loan_banned_until
    from updated_loans
  ),
  student_bans as (
    select
      returned_details.student_id,
      max(returned_details.new_loan_banned_until) as new_loan_banned_until
    from returned_details
    where returned_details.new_loan_banned_until is not null
    group by returned_details.student_id
  ),
  updated_students as (
    update public.students
    set loan_banned_until = case
      when students.loan_banned_until is null
        or students.loan_banned_until < student_bans.new_loan_banned_until
        then student_bans.new_loan_banned_until
      else students.loan_banned_until
    end
    from student_bans
    where students.id = student_bans.student_id
    returning students.id, students.loan_banned_until
  )
  select
    updated_loans.id as loan_id,
    target_loans.school_book_code,
    target_loans.book_title,
    target_loans.student_name,
    updated_loans.returned_on,
    returned_details.overdue_days,
    coalesce(updated_students.loan_banned_until, target_loans.previous_loan_banned_until) as loan_banned_until
  from updated_loans
  join target_loans on target_loans.id = updated_loans.id
  join returned_details on returned_details.id = updated_loans.id
  left join updated_students on updated_students.id = updated_loans.student_id
  order by target_loans.school_book_code;
$$;

grant execute on function public.get_returnable_loan_by_school_book_code(text) to anon, authenticated;
grant execute on function public.return_loans_by_school_book_codes(text[]) to anon, authenticated;


create index if not exists books_created_at_desc_idx
  on public.books (created_at desc);


alter table public.books
  drop column if exists location,
  drop column if exists published_year;

drop function if exists public.search_books(text);

create or replace function public.search_books(search_query text default '')
returns table (
  id uuid,
  isbn text,
  title text,
  author text,
  publisher text,
  category text,
  available_copies integer,
  total_copies integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    books.id,
    books.isbn,
    books.title,
    books.author,
    books.publisher,
    books.category,
    books.available_copies,
    books.total_copies
  from public.books
  where nullif(trim(search_query), '') is null
     or books.title ilike '%' || trim(search_query) || '%'
     or books.author ilike '%' || trim(search_query) || '%'
  order by books.title;
$$;


grant usage on schema public to sanuplib;
grant usage on schema auth to sanuplib;
grant usage on schema extensions to sanuplib;
grant all privileges on all tables in schema public to sanuplib;
grant all privileges on all tables in schema auth to sanuplib;
grant all privileges on all sequences in schema public to sanuplib;
grant all privileges on all sequences in schema auth to sanuplib;
grant execute on all functions in schema public to sanuplib;
grant execute on all functions in schema auth to sanuplib;
alter default privileges in schema public grant all privileges on tables to sanuplib;
alter default privileges in schema public grant all privileges on sequences to sanuplib;
alter default privileges in schema public grant execute on functions to sanuplib;
alter default privileges in schema auth grant all privileges on tables to sanuplib;
alter default privileges in schema auth grant all privileges on sequences to sanuplib;
alter default privileges in schema auth grant execute on functions to sanuplib;
