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
    case when target_student.loan_limit = 5 then '교직원' else '학생' end as borrower_label,
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
  v_borrower_label := case when v_loan_limit = 5 then '교직원' else '학생' end;

  if v_active_loan_count >= v_loan_limit then
    raise exception using
      errcode = '23514',
      message = v_borrower_label || '은 최대 ' || v_loan_limit || '권까지 대여할 수 있습니다. 현재 ' || v_active_loan_count || '권 대여 중입니다.';
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
