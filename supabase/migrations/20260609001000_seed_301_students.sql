with generated_students as (
  select
    '3' || lpad(class_number::text, 2, '0') || lpad(seat_number::text, 2, '0') as student_number,
    class_number,
    seat_number
  from generate_series(1, 10) as class_number
  cross join generate_series(1, 20) as seat_number
)
insert into public.students (student_number, name, grade, class_number, seat_number, email)
select
  student_number,
  case student_number
    when '30101' then '김서연'
    when '30102' then '이준호'
    when '30203' then '박민지'
    when '30304' then '최도현'
    when '30405' then '정하린'
    else '학생 ' || student_number
  end as name,
  3 as grade,
  class_number,
  seat_number,
  'student' || student_number || '@example.school' as email
from generated_students
on conflict (student_number) do update set
  name = excluded.name,
  grade = excluded.grade,
  class_number = excluded.class_number,
  seat_number = excluded.seat_number,
  email = excluded.email;
