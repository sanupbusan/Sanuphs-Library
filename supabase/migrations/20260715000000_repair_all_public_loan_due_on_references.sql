begin;

alter table public.books
  add column if not exists school_book_codes text[] not null default '{}';

update public.books as book_to_repair
set school_book_codes = '{}'::text[]
where book_to_repair.school_book_codes is null;

alter table public.books
  alter column school_book_codes set default '{}',
  alter column school_book_codes set not null;

alter table public.loans
  add column if not exists school_book_code text;

update public.books as book_to_backfill
set school_book_codes = array_append(
  book_to_backfill.school_book_codes,
  book_to_backfill.school_book_code
)
where book_to_backfill.school_book_code is not null
  and not (book_to_backfill.school_book_code = any(book_to_backfill.school_book_codes));

alter table public.loans
  add column if not exists due_on date;

do $$
declare
  trigger_to_remove record;
begin
  for trigger_to_remove in
    select loan_trigger.tgname as trigger_name
    from pg_trigger as loan_trigger
    join pg_class as loan_table on loan_table.oid = loan_trigger.tgrelid
    join pg_namespace as loan_schema on loan_schema.oid = loan_table.relnamespace
    join pg_proc as trigger_function on trigger_function.oid = loan_trigger.tgfoid
    where loan_schema.nspname = 'public'
      and loan_table.relname = 'loans'
      and not loan_trigger.tgisinternal
      and loan_trigger.tgname not in (
        'set_loans_updated_at',
        'sync_book_available_copies_on_loan_change',
        'enforce_borrower_loan_limit_on_loan_change'
      )
      and pg_get_functiondef(trigger_function.oid) ~* '\mdue_on\M'
  loop
    execute format(
      'drop trigger if exists %I on public.loans',
      trigger_to_remove.trigger_name
    );
  end loop;
end;
$$;

create or replace function public.sync_book_available_copies()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affected_book_id uuid;
begin
  if TG_OP = 'DELETE' then
    affected_book_id := OLD.book_id;
  else
    affected_book_id := NEW.book_id;
  end if;

  update public.books as target_book
  set available_copies = greatest(
    target_book.total_copies - (
      select count(*)::integer
      from public.loans as active_loan
      where active_loan.book_id = affected_book_id
        and active_loan.status = 'rented'
        and active_loan.returned_on is null
    ),
    0
  )
  where target_book.id = affected_book_id;

  if TG_OP = 'UPDATE' and OLD.book_id is distinct from NEW.book_id then
    update public.books as previous_book
    set available_copies = greatest(
      previous_book.total_copies - (
        select count(*)::integer
        from public.loans as previous_active_loan
        where previous_active_loan.book_id = OLD.book_id
          and previous_active_loan.status = 'rented'
          and previous_active_loan.returned_on is null
      ),
      0
    )
    where previous_book.id = OLD.book_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists sync_book_available_copies_on_loan_change on public.loans;

create trigger sync_book_available_copies_on_loan_change
  after insert or update or delete on public.loans
  for each row execute function public.sync_book_available_copies();

create or replace function public.enforce_borrower_loan_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_active_loan_count integer;
  v_borrower record;
  v_borrower_label text;
  v_borrower_loan_limit integer;
begin
  if NEW.status <> 'rented' or NEW.returned_on is not null then
    return NEW;
  end if;

  select borrower.student_number, borrower.class_number
  into v_borrower
  from public.students as borrower
  where borrower.id = NEW.student_id;

  if not found then
    return NEW;
  end if;

  v_borrower_loan_limit := public.get_borrower_loan_limit(
    v_borrower.student_number,
    v_borrower.class_number
  );
  v_borrower_label := case
    when v_borrower_loan_limit = 5 then U&'\AD50\C9C1\C6D0'
    else U&'\D559\C0DD'
  end;

  select count(*)::integer
  into v_active_loan_count
  from public.loans as existing_loan
  where existing_loan.student_id = NEW.student_id
    and existing_loan.status = 'rented'
    and existing_loan.returned_on is null
    and existing_loan.id is distinct from NEW.id;

  if v_active_loan_count >= v_borrower_loan_limit then
    raise exception using
      errcode = '23514',
      message = v_borrower_label || U&'\C740 \CD5C\B300 ' || v_borrower_loan_limit || U&'\AD8C\AE4C\C9C0 \B300\C5EC\D560 \C218 \C788\C2B5\B2C8\B2E4.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_borrower_loan_limit_on_loan_change on public.loans;

create trigger enforce_borrower_loan_limit_on_loan_change
  before insert or update of student_id, status, returned_on on public.loans
  for each row execute function public.enforce_borrower_loan_limit();

update public.loans as loan_to_repair
set due_on = coalesce(loan_to_repair.borrowed_on, current_date) + 14
where loan_to_repair.due_on is null;

alter table public.loans
  alter column due_on set default (current_date + 14),
  alter column due_on set not null;

create or replace view public.dashboard_summary
with (security_invoker = true)
as
select
  count(*)::integer as total_books,
  coalesce(sum(book.total_copies), 0)::integer as total_copies,
  coalesce(sum(book.available_copies), 0)::integer as available_copies,
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
  ) as overdue_loans
from public.books as book;

do $$
declare
  target_function record;
begin
  for target_function in
    select
      function_schema.nspname as schema_name,
      function_definition.proname as function_name,
      pg_get_function_identity_arguments(function_definition.oid) as function_arguments
    from pg_proc as function_definition
    join pg_namespace as function_schema on function_schema.oid = function_definition.pronamespace
    where function_schema.nspname = 'public'
      and function_definition.proname = 'create_public_loan'
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      target_function.schema_name,
      target_function.function_name,
      target_function.function_arguments
    );
  end loop;
end;
$$;

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
  v_due_date date := current_date + 14;
  v_loan_id uuid;
  v_loan_limit integer;
  v_oldest_overdue_due_date date;
  v_school_book_code text := nullif(trim(input_school_book_code), '');
  v_student record;
  v_today date := current_date;
begin
  select
    requested_book.id,
    requested_book.title,
    requested_book.available_copies,
    requested_book.school_book_code,
    requested_book.school_book_codes
  into v_book
  from public.books as requested_book
  where requested_book.id = input_book_id
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
        from public.loans as active_copy_loan
        where active_copy_loan.status = 'rented'
          and active_copy_loan.returned_on is null
          and (
            active_copy_loan.school_book_code = nullif(trim(candidate.school_book_code), '')
            or (
              active_copy_loan.school_book_code is null
              and active_copy_loan.book_id = input_book_id
              and nullif(trim(candidate.school_book_code), '') = nullif(trim(v_book.school_book_code), '')
            )
          )
      )
    order by candidate.position
    limit 1;

    if v_school_book_code is null
      and cardinality(coalesce(v_book.school_book_codes, '{}'::text[])) > 0 then
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

  select
    borrower.id,
    borrower.name,
    borrower.student_number,
    borrower.class_number,
    borrower.loan_banned_until
  into v_student
  from public.students as borrower
  where borrower.id = input_student_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'STUDENT_NOT_FOUND';
  end if;

  if v_student.loan_banned_until is not null
    and v_student.loan_banned_until >= v_today then
    raise exception using
      errcode = 'P0001',
      message = 'STUDENT_LOAN_BANNED|' || v_student.loan_banned_until::text;
  end if;

  select min(existing_loan.due_on)
  into v_oldest_overdue_due_date
  from public.loans as existing_loan
  where existing_loan.student_id = input_student_id
    and existing_loan.status = 'rented'
    and existing_loan.returned_on is null
    and existing_loan.due_on < v_today;

  if v_oldest_overdue_due_date is not null then
    raise exception using
      errcode = 'P0001',
      message = 'STUDENT_HAS_OVERDUE_LOAN|' || v_oldest_overdue_due_date::text;
  end if;

  if exists (
    select 1
    from public.loans as same_book_loan
    where same_book_loan.book_id = input_book_id
      and same_book_loan.student_id = input_student_id
      and same_book_loan.status = 'rented'
      and same_book_loan.returned_on is null
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_RENTED';
  end if;

  if v_school_book_code is not null and exists (
    select 1
    from public.loans as same_copy_loan
    where same_copy_loan.status = 'rented'
      and same_copy_loan.returned_on is null
      and (
        same_copy_loan.school_book_code = v_school_book_code
        or (
          same_copy_loan.school_book_code is null
          and same_copy_loan.book_id = input_book_id
          and v_school_book_code = nullif(trim(v_book.school_book_code), '')
        )
      )
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_RENTED';
  end if;

  select count(*)::integer
  into v_active_loan_count
  from public.loans as borrower_active_loan
  where borrower_active_loan.student_id = input_student_id
    and borrower_active_loan.status = 'rented'
    and borrower_active_loan.returned_on is null;

  v_loan_limit := public.get_borrower_loan_limit(
    v_student.student_number,
    v_student.class_number
  );
  v_borrower_type := case when v_loan_limit = 5 then 'staff' else 'student' end;
  v_borrower_label := case
    when v_loan_limit = 5 then U&'\AD50\C9C1\C6D0'
    else U&'\D559\C0DD'
  end;

  if v_active_loan_count >= v_loan_limit then
    raise exception using
      errcode = '23514',
      message = v_borrower_label || U&'\C740 \CD5C\B300 ' || v_loan_limit || U&'\AD8C\AE4C\C9C0 \B300\C5EC\D560 \C218 \C788\C2B5\B2C8\B2E4. \D604\C7AC ' || v_active_loan_count || U&'\AD8C \B300\C5EC \C911\C785\B2C8\B2E4.';
  end if;

  insert into public.loans as inserted_loan (
    book_id,
    student_id,
    borrowed_on,
    due_on,
    school_book_code,
    notes
  )
  values (
    input_book_id,
    input_student_id,
    v_today,
    v_due_date,
    v_school_book_code,
    nullif(trim(input_notes), '')
  )
  returning inserted_loan.id
  into v_loan_id;

  return query
  select
    v_book.title::text,
    (v_active_loan_count + 1)::integer,
    v_borrower_label::text,
    v_borrower_type::text,
    v_due_date::date,
    v_loan_id::uuid,
    v_loan_limit::integer,
    greatest(v_loan_limit - v_active_loan_count - 1, 0)::integer,
    v_student.name::text;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ALREADY_RENTED';
end;
$$;

grant execute on function public.create_public_loan(uuid, uuid, text, text)
  to anon, authenticated, sanuplib;

notify pgrst, 'reload schema';

commit;
