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
