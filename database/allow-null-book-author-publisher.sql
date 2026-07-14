begin;

alter table public.books
  alter column author drop not null;

update public.books
set author = null
where btrim(author) = '';

update public.books
set publisher = null
where btrim(publisher) = '';

commit;
