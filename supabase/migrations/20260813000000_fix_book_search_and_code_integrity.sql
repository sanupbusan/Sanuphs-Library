begin;

alter table public.books
  add column if not exists school_book_code text;

alter table public.books
  add column if not exists school_book_codes text[] not null default '{}';

update public.books
set isbn = null
where isbn is not null
  and nullif(trim(isbn), '') is null;

update public.books
set school_book_code = null
where school_book_code is not null
  and nullif(trim(school_book_code), '') is null;

update public.books as book_to_repair
set school_book_codes = '{}'::text[]
where book_to_repair.school_book_codes is null;

update public.books as book_to_repair
set school_book_codes = array_append(
  coalesce(book_to_repair.school_book_codes, '{}'::text[]),
  book_to_repair.school_book_code
)
where nullif(trim(book_to_repair.school_book_code), '') is not null
  and not (
    book_to_repair.school_book_code = any(
      coalesce(book_to_repair.school_book_codes, '{}'::text[])
    )
  );

alter table public.books
  alter column school_book_codes set default '{}',
  alter column school_book_codes set not null;

create index if not exists books_school_book_codes_idx
  on public.books using gin (school_book_codes);

drop function if exists public.search_books(text);

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
  school_book_code text,
  school_book_codes text[]
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
    books.school_book_code,
    books.school_book_codes
  from public.books
  where nullif(trim(search_query), '') is null
     or books.title ilike '%' || trim(search_query) || '%'
     or books.author ilike '%' || trim(search_query) || '%'
     or books.publisher ilike '%' || trim(search_query) || '%'
     or books.isbn ilike '%' || trim(search_query) || '%'
     or books.school_book_code ilike '%' || trim(search_query) || '%'
     or (
       nullif(regexp_replace(upper(trim(search_query)), '[^0-9X]', '', 'g'), '') is not null
       and regexp_replace(upper(coalesce(books.isbn, '')), '[^0-9X]', '', 'g') ilike '%' ||
         regexp_replace(upper(trim(search_query)), '[^0-9X]', '', 'g') || '%'
     )
     or (
       nullif(regexp_replace(upper(trim(search_query)), '[^0-9A-Z-]', '', 'g'), '') is not null
       and regexp_replace(upper(coalesce(books.school_book_code, '')), '[^0-9A-Z-]', '', 'g') ilike '%' ||
         regexp_replace(upper(trim(search_query)), '[^0-9A-Z-]', '', 'g') || '%'
     )
     or exists (
       select 1
       from unnest(coalesce(books.school_book_codes, '{}'::text[])) as school_book_code(value)
       where value ilike '%' || trim(search_query) || '%'
          or (
            nullif(regexp_replace(upper(trim(search_query)), '[^0-9A-Z-]', '', 'g'), '') is not null
            and regexp_replace(upper(value), '[^0-9A-Z-]', '', 'g') ilike '%' ||
              regexp_replace(upper(trim(search_query)), '[^0-9A-Z-]', '', 'g') || '%'
          )
     )
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
  with normalized_code as (
    select nullif(trim(input_school_book_code), '') as school_book_code
  )
  select
    loans.id as loan_id,
    coalesce(loans.school_book_code, normalized_code.school_book_code, books.school_book_code) as school_book_code,
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
        and (
          books.school_book_code = normalized_code.school_book_code
          or normalized_code.school_book_code = any(coalesce(books.school_book_codes, '{}'::text[]))
        )
      )
    )
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
      coalesce(loans.school_book_code, normalized_codes.school_book_code, books.school_book_code) as school_book_code,
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
        and (
          normalized_codes.school_book_code = books.school_book_code
          or normalized_codes.school_book_code = any(coalesce(books.school_book_codes, '{}'::text[]))
        )
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

grant execute on function public.search_books(text) to anon, authenticated;
grant execute on function public.get_returnable_loan_by_school_book_code(text) to anon, authenticated;
grant execute on function public.return_loans_by_school_book_codes(text[]) to anon, authenticated;

commit;
