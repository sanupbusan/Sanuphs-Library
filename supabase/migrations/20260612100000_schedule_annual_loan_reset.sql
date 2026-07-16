create extension if not exists pg_cron with schema extensions;

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

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'annual-loan-record-reset-kst'
  ) then
    perform cron.unschedule('annual-loan-record-reset-kst');
  end if;
end;
$$;

select cron.schedule(
  'annual-loan-record-reset-kst',
  '0 15 31 12 *',
  'select public.reset_annual_loan_records();'
);
