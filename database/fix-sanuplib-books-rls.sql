begin;

alter table public.books enable row level security;

grant usage on schema public to sanuplib;
grant select, insert, update, delete on public.books to sanuplib;

drop policy if exists app_books on public.books;

create policy app_books
  on public.books for all
  to sanuplib
  using (true)
  with check (true);

commit;
