begin;

create or replace function public.get_backend_loan_by_id(input_loan_id uuid)
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
    target_loan.id,
    target_loan.book_id,
    target_loan.student_id,
    target_loan.borrowed_on,
    target_loan.due_on,
    target_loan.returned_on,
    target_loan.status,
    book.title as book_title,
    coalesce(target_loan.school_book_code, book.school_book_code) as book_school_book_code,
    student.name as student_name,
    student.student_number
  from public.loans as target_loan
  left join public.books as book on book.id = target_loan.book_id
  left join public.students as student on student.id = target_loan.student_id
  where target_loan.id = input_loan_id
  limit 1;
$$;

create or replace function public.update_backend_loan_fields(
  input_loan_id uuid,
  input_borrowed_on date,
  input_due_on date,
  input_returned_on date,
  input_status public.loan_status,
  input_update_borrowed_on boolean,
  input_update_due_on boolean,
  input_update_returned_on boolean,
  input_update_status boolean
)
returns table (loan_id uuid)
language sql
volatile
security definer
set search_path = public
as $$
  update public.loans as target_loan
  set
    borrowed_on = case
      when coalesce(input_update_borrowed_on, false) then input_borrowed_on
      else target_loan.borrowed_on
    end,
    due_on = case
      when coalesce(input_update_due_on, false) then input_due_on
      else target_loan.due_on
    end,
    returned_on = case
      when coalesce(input_update_returned_on, false) then input_returned_on
      else target_loan.returned_on
    end,
    status = case
      when coalesce(input_update_status, false) then input_status
      else target_loan.status
    end
  where target_loan.id = input_loan_id
  returning target_loan.id as loan_id;
$$;

create or replace function public.list_backend_admin_overdue_loans(
  input_today date default current_date,
  input_limit integer default 100
)
returns table (
  id uuid,
  borrowed_on date,
  due_on date,
  book_title text,
  student_name text,
  student_number text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    overdue_loan.id,
    overdue_loan.borrowed_on,
    overdue_loan.due_on,
    book.title as book_title,
    student.name as student_name,
    student.student_number
  from public.loans as overdue_loan
  left join public.books as book on book.id = overdue_loan.book_id
  left join public.students as student on student.id = overdue_loan.student_id
  where overdue_loan.status = 'rented'
    and overdue_loan.returned_on is null
    and overdue_loan.due_on < coalesce(input_today, current_date)
  order by overdue_loan.due_on asc
  limit least(greatest(coalesce(input_limit, 100), 1), 500);
$$;

revoke all on function public.get_backend_loan_by_id(uuid) from public;
revoke all on function public.update_backend_loan_fields(uuid, date, date, date, public.loan_status, boolean, boolean, boolean, boolean) from public;
revoke all on function public.list_backend_admin_overdue_loans(date, integer) from public;

grant execute on function public.get_backend_loan_by_id(uuid) to sanuplib;
grant execute on function public.update_backend_loan_fields(uuid, date, date, date, public.loan_status, boolean, boolean, boolean, boolean) to sanuplib;
grant execute on function public.list_backend_admin_overdue_loans(date, integer) to sanuplib;

notify pgrst, 'reload schema';

commit;
