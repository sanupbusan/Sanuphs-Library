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
