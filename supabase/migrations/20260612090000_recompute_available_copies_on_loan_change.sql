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
    total_copies - (
      select count(*)::integer
      from public.loans
      where loans.book_id = affected_book_id
        and loans.status = 'rented'
    ),
    0
  )
  where books.id = affected_book_id;

  if (TG_OP = 'UPDATE' and OLD.book_id is distinct from NEW.book_id) then
    update public.books
    set available_copies = greatest(
      total_copies - (
        select count(*)::integer
        from public.loans
        where loans.book_id = OLD.book_id
          and loans.status = 'rented'
      ),
      0
    )
    where books.id = OLD.book_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists sync_book_available_copies_on_loan_change on public.loans;

create trigger sync_book_available_copies_on_loan_change
  after insert or update or delete on public.loans
  for each row execute function public.sync_book_available_copies();

with rented_counts as (
  select
    books.id as book_id,
    count(loans.id) filter (where loans.status = 'rented')::integer as rented_count
  from public.books
  left join public.loans on loans.book_id = books.id
  group by books.id
)
update public.books
set available_copies = greatest(books.total_copies - rented_counts.rented_count, 0)
from rented_counts
where books.id = rented_counts.book_id;
