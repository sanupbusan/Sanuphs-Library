create extension if not exists pgcrypto with schema extensions;

create type public.loan_status as enum ('rented', 'returned');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'purchased');

create table public.books (
  id uuid primary key default gen_random_uuid(),
  isbn text unique,
  title text not null,
  author text not null,
  publisher text,
  category text not null default '미분류',
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
