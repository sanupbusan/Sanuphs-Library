alter table public.books
  add column if not exists school_book_codes text[] not null default '{}';

alter table public.books
  alter column school_book_codes set default '{}';

update public.books
set school_book_codes = '{}'::text[]
where school_book_codes is null;

alter table public.books
  alter column school_book_codes set not null;

alter table public.loans
  add column if not exists school_book_code text;

update public.books
set school_book_codes = array_append(school_book_codes, school_book_code)
where school_book_code is not null
  and not school_book_code = any(school_book_codes);

create index if not exists books_school_book_codes_idx
  on public.books using gin (school_book_codes);

create unique index if not exists loans_one_active_school_book_code_idx
  on public.loans (school_book_code)
  where status = 'rented'
    and school_book_code is not null;

do $$
declare
  target_function record;
begin
  for target_function in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as function_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_public_loan'
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      target_function.schema_name,
      target_function.function_name,
      target_function.function_arguments
    );
  end loop;
end $$;

create function public.create_public_loan(
  input_book_id uuid,
  input_student_id uuid,
  input_notes text default null,
  input_school_book_code text default null
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
  v_oldest_overdue_due_on date;
  v_school_book_code text := nullif(trim(input_school_book_code), '');
  v_student record;
  v_today date := current_date;
begin
  select books.id, books.title, books.available_copies, books.school_book_code, books.school_book_codes
  into v_book
  from public.books
  where books.id = input_book_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOK_NOT_FOUND';
  end if;

  if v_school_book_code is null then
    select nullif(trim(candidate.school_book_code), '')
    into v_school_book_code
    from unnest(
      case
        when cardinality(coalesce(v_book.school_book_codes, '{}'::text[])) > 0
          then v_book.school_book_codes
        else array_remove(array[v_book.school_book_code], null)
      end
    ) with ordinality as candidate(school_book_code, position)
    where nullif(trim(candidate.school_book_code), '') is not null
      and not exists (
        select 1
        from public.loans
        where loans.status = 'rented'
          and loans.returned_on is null
          and (
            loans.school_book_code = nullif(trim(candidate.school_book_code), '')
            or (
              loans.school_book_code is null
              and loans.book_id = input_book_id
              and nullif(trim(candidate.school_book_code), '') = nullif(trim(v_book.school_book_code), '')
            )
          )
      )
    order by candidate.position
    limit 1;

    if v_school_book_code is null and cardinality(coalesce(v_book.school_book_codes, '{}'::text[])) > 0 then
      raise exception using errcode = 'P0001', message = 'NO_AVAILABLE_COPIES';
    end if;
  end if;

  if v_school_book_code is not null
    and v_school_book_code is distinct from v_book.school_book_code
    and not (v_school_book_code = any(coalesce(v_book.school_book_codes, '{}'::text[]))) then
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

  if v_school_book_code is not null and exists (
    select 1
    from public.loans
    where loans.status = 'rented'
      and loans.returned_on is null
      and (
        loans.school_book_code = v_school_book_code
        or (
          loans.school_book_code is null
          and loans.book_id = input_book_id
          and v_school_book_code = nullif(trim(v_book.school_book_code), '')
        )
      )
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

  insert into public.loans as new_loan (book_id, student_id, school_book_code, notes)
  values (input_book_id, input_student_id, v_school_book_code, nullif(trim(input_notes), ''))
  returning new_loan.id, new_loan.due_on
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

grant execute on function public.create_public_loan(uuid, uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
