update public.books
set available_copies = (
  select count(*)
  from public.loans
  where loans.book_id = books.id
    and loans.status = 'rented'
)
where exists (
  select 1 from public.loans where loans.book_id = books.id
);
