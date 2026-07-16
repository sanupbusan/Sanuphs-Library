create or replace function public.sync_book_available_copies()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'rented') then
    update public.books
    set available_copies = available_copies - 1
    where id = NEW.book_id;
  elsif (TG_OP = 'UPDATE') then
    if (OLD.status = 'rented' and NEW.status = 'returned') then
      update public.books
      set available_copies = available_copies + 1
      where id = NEW.book_id;
    elsif (OLD.status = 'returned' and NEW.status = 'rented') then
      update public.books
      set available_copies = available_copies - 1
      where id = NEW.book_id;
    end if;
  elsif (TG_OP = 'DELETE' and OLD.status = 'rented') then
    update public.books
    set available_copies = available_copies + 1
    where id = OLD.book_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

create trigger sync_book_available_copies_on_loan_change
  after insert or update or delete on public.loans
  for each row execute function public.sync_book_available_copies();
