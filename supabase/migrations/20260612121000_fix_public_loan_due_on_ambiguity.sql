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
  v_borrower_label := case when v_loan_limit = 5 then '교직원' else '학생' end;

  if v_active_loan_count >= v_loan_limit then
    raise exception using
      errcode = '23514',
      message = v_borrower_label || '은 최대 ' || v_loan_limit || '권까지 대여할 수 있습니다. 현재 ' || v_active_loan_count || '권 대여 중입니다.';
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
