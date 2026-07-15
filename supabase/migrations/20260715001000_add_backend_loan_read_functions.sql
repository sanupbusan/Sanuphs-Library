begin;

alter table public.books
  add column if not exists school_book_code text;

alter table public.loans
  add column if not exists school_book_code text;

create or replace function public.get_backend_dashboard_summary()
returns table (
  total_books integer,
  total_copies integer,
  available_copies integer,
  active_loans integer,
  overdue_loans integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from public.books as book) as total_books,
    (select coalesce(sum(book.total_copies), 0)::integer from public.books as book) as total_copies,
    (select coalesce(sum(book.available_copies), 0)::integer from public.books as book) as available_copies,
    (
      select count(*)::integer
      from public.loans as active_loan
      where active_loan.status = 'rented'
        and active_loan.returned_on is null
    ) as active_loans,
    (
      select count(*)::integer
      from public.loans as overdue_loan
      where overdue_loan.status = 'rented'
        and overdue_loan.returned_on is null
        and overdue_loan.due_on < current_date
    ) as overdue_loans;
$$;

create or replace function public.list_backend_dashboard_recent_loans(input_limit integer default 5)
returns table (
  id uuid,
  student_name text,
  book_title text,
  rental_date date,
  return_date date,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    recent_loan.id,
    coalesce(student.name, '-')::text as student_name,
    coalesce(book.title, '-')::text as book_title,
    recent_loan.borrowed_on as rental_date,
    recent_loan.due_on as return_date,
    case
      when recent_loan.status = 'returned' then 'returned'
      when recent_loan.due_on < current_date then 'overdue'
      else 'rented'
    end::text as status
  from public.loans as recent_loan
  left join public.students as student on student.id = recent_loan.student_id
  left join public.books as book on book.id = recent_loan.book_id
  order by recent_loan.borrowed_on desc, recent_loan.created_at desc
  limit least(greatest(coalesce(input_limit, 5), 1), 50);
$$;

create or replace function public.list_backend_active_loans()
returns table (
  id uuid,
  book_id uuid,
  student_id uuid,
  borrowed_on date,
  due_on date,
  returned_on date,
  status public.loan_status,
  book_title text,
  book_school_book_code text,
  student_name text,
  student_number text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    active_loan.id,
    active_loan.book_id,
    active_loan.student_id,
    active_loan.borrowed_on,
    active_loan.due_on,
    active_loan.returned_on,
    active_loan.status,
    book.title as book_title,
    coalesce(active_loan.school_book_code, book.school_book_code) as book_school_book_code,
    student.name as student_name,
    student.student_number
  from public.loans as active_loan
  left join public.books as book on book.id = active_loan.book_id
  left join public.students as student on student.id = active_loan.student_id
  where active_loan.status = 'rented'
    and active_loan.returned_on is null
  order by active_loan.borrowed_on desc, active_loan.created_at desc;
$$;

create or replace function public.list_backend_dashboard_overdue_loans(input_limit integer default 20)
returns table (
  id uuid,
  due_on date,
  student_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    overdue_loan.id,
    overdue_loan.due_on,
    coalesce(student.name, '-')::text as student_name
  from public.loans as overdue_loan
  left join public.students as student on student.id = overdue_loan.student_id
  where overdue_loan.status = 'rented'
    and overdue_loan.returned_on is null
    and overdue_loan.due_on < current_date
  order by overdue_loan.due_on asc
  limit least(greatest(coalesce(input_limit, 20), 1), 100);
$$;

create or replace function public.list_backend_student_loan_stats()
returns table (
  student_id uuid,
  student_name text,
  total_loans integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    student_loan.student_id,
    coalesce(student.name, '-')::text as student_name,
    count(student_loan.id)::integer as total_loans
  from public.loans as student_loan
  left join public.students as student on student.id = student_loan.student_id
  group by student_loan.student_id, student.name;
$$;

revoke all on function public.get_backend_dashboard_summary() from public;
revoke all on function public.list_backend_dashboard_recent_loans(integer) from public;
revoke all on function public.list_backend_active_loans() from public;
revoke all on function public.list_backend_dashboard_overdue_loans(integer) from public;
revoke all on function public.list_backend_student_loan_stats() from public;

grant execute on function public.get_backend_dashboard_summary() to sanuplib;
grant execute on function public.list_backend_dashboard_recent_loans(integer) to sanuplib;
grant execute on function public.list_backend_active_loans() to sanuplib;
grant execute on function public.list_backend_dashboard_overdue_loans(integer) to sanuplib;
grant execute on function public.list_backend_student_loan_stats() to sanuplib;

notify pgrst, 'reload schema';

commit;
