alter table public.books
  add column if not exists school_book_codes text[] not null default '{}';

update public.books
set school_book_codes = array_append(school_book_codes, school_book_code)
where school_book_code is not null
  and not school_book_code = any(school_book_codes);

create index if not exists books_school_book_codes_idx
  on public.books using gin (school_book_codes);

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
    normalized_code.school_book_code,
    books.title as book_title,
    students.name as student_name,
    loans.borrowed_on,
    loans.due_on
  from normalized_code
  join public.books on normalized_code.school_book_code = any(books.school_book_codes)
    or books.school_book_code = normalized_code.school_book_code
  join public.loans on loans.book_id = books.id
  join public.students on students.id = loans.student_id
  where normalized_code.school_book_code is not null
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
      normalized_codes.school_book_code,
      books.title as book_title,
      students.name as student_name
    from normalized_codes
    join public.books on normalized_codes.school_book_code = any(books.school_book_codes)
      or books.school_book_code = normalized_codes.school_book_code
    join public.loans on loans.book_id = books.id
    join public.students on students.id = loans.student_id
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

grant execute on function public.get_returnable_loan_by_school_book_code(text) to anon, authenticated;
grant execute on function public.return_loans_by_school_book_codes(text[]) to anon, authenticated;
