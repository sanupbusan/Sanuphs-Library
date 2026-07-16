alter table public.books
  add column if not exists school_book_code text;

create unique index if not exists books_school_book_code_idx
  on public.books (school_book_code)
  where school_book_code is not null;
