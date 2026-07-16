create or replace function public.search_books(search_query text default '')
returns table (
  id uuid,
  isbn text,
  title text,
  author text,
  publisher text,
  category text,
  available_copies integer,
  total_copies integer,
  location text
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
    books.location
  from public.books
  where nullif(trim(search_query), '') is null
     or books.title ilike '%' || trim(search_query) || '%'
     or books.author ilike '%' || trim(search_query) || '%'
  order by books.title;
$$;
