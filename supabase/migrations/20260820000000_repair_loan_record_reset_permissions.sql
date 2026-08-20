create or replace function public.reset_annual_loan_records()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.loans;

  update public.books
  set available_copies = total_copies;
end;
$$;

revoke all on function public.reset_annual_loan_records() from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sanuplib') then
    execute 'grant execute on function public.reset_annual_loan_records() to sanuplib';
  end if;

  if exists (select 1 from pg_roles where rolname = 'library_user') then
    execute 'grant execute on function public.reset_annual_loan_records() to library_user';
  end if;
end;
$$;
