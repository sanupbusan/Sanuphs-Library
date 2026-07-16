alter table public.loans
  drop constraint if exists loans_book_id_fkey;

alter table public.loans
  add constraint loans_book_id_fkey
    foreign key (book_id) references public.books(id)
    on delete cascade;
