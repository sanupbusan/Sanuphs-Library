create or replace function public.get_borrower_loan_limit(
  input_student_number text,
  input_class_number smallint
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(input_student_number, '') ~* '^T[0-9]{2}$'
      or input_class_number = 99 then 5
    else 2
  end;
$$;

create or replace function public.enforce_borrower_loan_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_loan_count integer;
  borrower record;
  borrower_label text;
  loan_limit integer;
begin
  if NEW.status <> 'rented' or NEW.returned_on is not null then
    return NEW;
  end if;

  select students.student_number, students.class_number
  into borrower
  from public.students
  where students.id = NEW.student_id;

  if not found then
    return NEW;
  end if;

  loan_limit := public.get_borrower_loan_limit(
    borrower.student_number,
    borrower.class_number
  );
  borrower_label := case when loan_limit = 5 then '교직원' else '학생' end;

  select count(*)::integer
  into active_loan_count
  from public.loans
  where loans.student_id = NEW.student_id
    and loans.status = 'rented'
    and loans.returned_on is null
    and loans.id is distinct from NEW.id;

  if active_loan_count >= loan_limit then
    raise exception using
      errcode = '23514',
      message = borrower_label || '은 최대 ' || loan_limit || '권까지 대여할 수 있습니다.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_borrower_loan_limit_on_loan_change on public.loans;

create trigger enforce_borrower_loan_limit_on_loan_change
  before insert or update of student_id, status, returned_on on public.loans
  for each row execute function public.enforce_borrower_loan_limit();

grant execute on function public.get_borrower_loan_limit(text, smallint) to authenticated;
