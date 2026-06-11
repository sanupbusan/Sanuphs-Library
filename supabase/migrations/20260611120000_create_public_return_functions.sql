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
