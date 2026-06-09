insert into public.books (id, isbn, title, author, publisher, category, published_year, total_copies, available_copies, location)
values
  ('8f90e4f2-7b77-4f6f-8fd0-41d8470f78fd', '9788936434267', '아몬드', '손원평', '창비', '한국소설', 2017, 5, 4, 'A-01'),
  ('b4251b71-3eb6-41d2-a748-703b995dcf39', '9791161571188', '불편한 편의점', '김호연', '나무옆의자', '한국소설', 2021, 4, 3, 'A-02'),
  ('fd79b4b6-23d5-47b5-b8b2-54e1561b5cb8', '9788937473135', '82년생 김지영', '조남주', '민음사', '한국소설', 2016, 3, 2, 'A-03'),
  ('0b3a1387-2215-4cf5-a1af-3e1a0f86c6fc', '9788937460449', '데미안', '헤르만 헤세', '민음사', '세계문학', 2000, 2, 1, 'B-01'),
  ('db2d37cc-8eb1-4244-9326-bc4bf6388a1b', '9788932917245', '어린 왕자', '앙투안 드 생텍쥐페리', '열린책들', '세계문학', 2015, 6, 5, 'B-02')
on conflict (id) do nothing;

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

insert into public.loans (id, book_id, student_id, borrowed_on, due_on, status)
values
  ('327ce6fb-0a2e-4986-b9cc-ecdd8409fe1f', '8f90e4f2-7b77-4f6f-8fd0-41d8470f78fd', (select id from public.students where student_number = '30101'), current_date - 7, current_date + 7, 'rented'),
  ('227789c8-1cd1-44b5-a4b4-61f7d7861e6c', 'b4251b71-3eb6-41d2-a748-703b995dcf39', (select id from public.students where student_number = '30102'), current_date - 8, current_date + 6, 'rented'),
  ('cdb26bd0-f7c7-4b5c-87e4-13e1dd319ac7', 'fd79b4b6-23d5-47b5-b8b2-54e1561b5cb8', (select id from public.students where student_number = '30203'), current_date - 20, current_date - 6, 'rented'),
  ('2dce6cd5-cac7-49a7-9640-131b13478570', '0b3a1387-2215-4cf5-a1af-3e1a0f86c6fc', (select id from public.students where student_number = '30304'), current_date - 18, current_date - 4, 'rented'),
  ('b84073b0-ae23-4354-b774-a0488107d8c1', 'db2d37cc-8eb1-4244-9326-bc4bf6388a1b', (select id from public.students where student_number = '30405'), current_date - 6, current_date + 8, 'rented')
on conflict (id) do nothing;

insert into public.book_requests (id, student_id, requester_name, title, author, reason, status)
values
  ('f5ffde9a-7dfc-4d41-a495-c8d22b299292', (select id from public.students where student_number = '30101'), '김서연', '프로젝트 헤일메리', '앤디 위어', '과학 소설 독서 모임 희망 도서', 'pending')
on conflict (id) do nothing;
