do $$
declare
  trigger_to_remove record;
begin
  for trigger_to_remove in
    select loan_triggers.tgname as trigger_name
    from pg_trigger loan_triggers
    join pg_class loan_table on loan_table.oid = loan_triggers.tgrelid
    join pg_namespace loan_schema on loan_schema.oid = loan_table.relnamespace
    join pg_proc trigger_function on trigger_function.oid = loan_triggers.tgfoid
    where loan_schema.nspname = 'public'
      and loan_table.relname = 'loans'
      and not loan_triggers.tgisinternal
      and loan_triggers.tgname not in (
        'set_loans_updated_at',
        'sync_book_available_copies_on_loan_change',
        'enforce_borrower_loan_limit_on_loan_change'
      )
      and pg_get_functiondef(trigger_function.oid) ~* '\mdue_on\M'
  loop
    execute format('drop trigger if exists %I on public.loans', trigger_to_remove.trigger_name);
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
  if (TG_OP = 'DELETE') then
    affected_book_id := OLD.book_id;
  else
    affected_book_id := NEW.book_id;
  end if;

  update public.books
  set available_copies = greatest(
    public.books.total_copies - (
      select count(*)::integer
      from public.loans
      where public.loans.book_id = affected_book_id
        and public.loans.status = 'rented'
    ),
    0
  )
  where public.books.id = affected_book_id;

  if (TG_OP = 'UPDATE' and OLD.book_id is distinct from NEW.book_id) then
    update public.books
    set available_copies = greatest(
      public.books.total_copies - (
        select count(*)::integer
        from public.loans
        where public.loans.book_id = OLD.book_id
          and public.loans.status = 'rented'
      ),
      0
    )
    where public.books.id = OLD.book_id;
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
  active_loan_count integer;
  borrower record;
  borrower_label text;
  borrower_loan_limit integer;
begin
  if NEW.status <> 'rented' or NEW.returned_on is not null then
    return NEW;
  end if;

  select public.students.student_number, public.students.class_number
  into borrower
  from public.students
  where public.students.id = NEW.student_id;

  if not found then
    return NEW;
  end if;

  borrower_loan_limit := public.get_borrower_loan_limit(
    borrower.student_number,
    borrower.class_number
  );
  borrower_label := case when borrower_loan_limit = 5 then '교직원' else '학생' end;

  select count(*)::integer
  into active_loan_count
  from public.loans
  where public.loans.student_id = NEW.student_id
    and public.loans.status = 'rented'
    and public.loans.returned_on is null
    and public.loans.id is distinct from NEW.id;

  if active_loan_count >= borrower_loan_limit then
    raise exception using
      errcode = '23514',
      message = borrower_label || '은 최대 ' || borrower_loan_limit || '권까지 대여할 수 있습니다.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_borrower_loan_limit_on_loan_change on public.loans;

create trigger enforce_borrower_loan_limit_on_loan_change
  before insert or update of student_id, status, returned_on on public.loans
  for each row execute function public.enforce_borrower_loan_limit();

create or replace view public.dashboard_summary
with (security_invoker = true)
as
select
  count(*)::integer as total_books,
  coalesce(sum(public.books.total_copies), 0)::integer as total_copies,
  coalesce(sum(public.books.available_copies), 0)::integer as available_copies,
  (
    select count(*)::integer
    from public.loans
    where public.loans.status = 'rented'
  ) as active_loans,
  (
    select count(*)::integer
    from public.loans
    where public.loans.status = 'rented'
      and public.loans.due_on < current_date
  ) as overdue_loans
from public.books;
