begin;

create or replace function public.list_borrowers_for_barcode_print()
returns table (
  id uuid,
  student_number text,
  name text,
  grade smallint,
  class_number smallint,
  seat_number smallint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    students.id,
    students.student_number,
    students.name,
    students.grade,
    students.class_number,
    students.seat_number
  from public.students
  order by
    case when students.class_number = 99 or students.student_number ~* '^T[0-9]{2}$' then 1 else 0 end,
    students.grade,
    students.class_number,
    students.seat_number,
    students.student_number;
$$;

revoke all on function public.list_borrowers_for_barcode_print() from public;
grant execute on function public.list_borrowers_for_barcode_print() to sanuplib;

commit;
