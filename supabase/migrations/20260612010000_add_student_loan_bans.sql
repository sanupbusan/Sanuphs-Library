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
          updated_loans.returned_on + ((updated_loans.returned_on - updated_loans.due_on)::integer - 1)
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
