insert into public.students (student_number, name, grade, class_number, seat_number)
select
  '3' || lpad(class_num::text, 2, '0') || lpad(seat_num::text, 2, '0'),
  '학생' || ('3' || lpad(class_num::text, 2, '0') || lpad(seat_num::text, 2, '0')),
  3,
  class_num,
  seat_num
from generate_series(1, 10) as class_num,
     generate_series(1, 20) as seat_num
on conflict (student_number) do nothing;

insert into public.students (student_number, name, grade, class_number, seat_number)
select
  'T' || lpad(num::text, 2, '0'),
  '교직원' || lpad(num::text, 2, '0'),
  3,
  99,
  num
from generate_series(1, 30) as num
on conflict (student_number) do nothing;
