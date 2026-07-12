# Database setup

이 프로젝트는 현재 Supabase CLI migration 파일을 사용하지 않고, 신규/로컬 PostgreSQL bootstrap은 `database/local-postgres-copy-paste.sql` 롤업 스크립트 하나로 관리합니다.

## Environment variables

`.env.example`을 기준으로 로컬 또는 배포 환경에 값을 등록합니다.

```bash
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<database>
ADMIN_LOGIN_ID=SanupLib
ADMIN_SESSION_SECRET=<32+ chars random secret>
ADMIN_COOKIE_SECURE=false
NATIONAL_LIBRARY_ISBN_API_KEY=<national-library-isbn-api-key>
```

- `DATABASE_URL`: 앱이 연결할 PostgreSQL URL입니다.
- `ADMIN_LOGIN_ID`: 로그인 화면에서 입력할 관리자 아이디입니다. 기본값은 `SanupLib`입니다.
- `ADMIN_SESSION_SECRET`: 관리자 signed session cookie 서명에 사용합니다.
- `ADMIN_COOKIE_SECURE`: HTTP IP 접속에서는 `false`, HTTPS 도메인 접속에서는 `true`로 설정합니다.
- `NATIONAL_LIBRARY_ISBN_API_KEY`: 새 책 추가 화면에서 ISBN으로 책 정보를 조회할 때 사용하는 국립중앙도서관 ISBN API 키입니다. 서버 전용이므로 `NEXT_PUBLIC_`을 붙이지 않습니다.
- `.env`, `.env.local`, `.env.production` 같은 실제 값 파일은 커밋하지 않습니다.

## Schema bootstrap

신규 DB에는 롤업 SQL을 적용합니다.

```bash
psql "$DATABASE_URL" -f ./database/local-postgres-copy-paste.sql
```

이 스크립트에는 테이블, view, function, trigger, RLS policy, 초기 관리자 계정 보정 로직이 포함되어 있습니다.

## Annual loan reset

롤업 SQL에는 `public.reset_annual_loan_records()` 함수와 pg_cron 예약 로직이 포함되어 있습니다.

- Supabase의 `pg_cron` 또는 PostgreSQL의 호환 cron extension을 사용합니다.
- 예약 시각은 UTC 기준 `0 15 31 12 *`이며, 한국시간 1월 1일 00:00입니다.
- 초기화 시 `public.loans`의 모든 대여 기록을 삭제하고, 모든 도서의 `available_copies`를 `total_copies`로 맞춥니다.

## Book search API

도서 검색 backend endpoint는 다음과 같습니다.

```http
GET /api/books/search?q=<검색어>&limit=20
```

- `q` 또는 `query`: 제목 또는 저자 검색어입니다. 빈 값이면 등록된 도서를 제한 개수만큼 조회합니다.
- `limit`: 선택값이며 기본 20, 최대 50입니다.
- DB의 `search_books` function을 호출합니다.

## Admin book registration

새 책 등록은 로그인된 관리자만 사용할 수 있습니다. 화면의 단일 도서 등록 mutation은 Server Action을 사용합니다.

- 화면 경로: `/admin/add_books`
- `school_book_code`는 학교 내 도서 바코드 값이며 중복 등록을 막습니다.
- ISBN 입력 후 Enter 또는 조회 버튼을 누르면 서버 API가 국립중앙도서관 ISBN API를 호출해 책 이름, 저자, 출판사를 자동 입력합니다.

ISBN 조회 endpoint:

```http
GET /api/admin/books/isbn?isbn=<ISBN>
```

- 로그인된 관리자만 호출할 수 있습니다.
- 내부적으로 `NATIONAL_LIBRARY_ISBN_API_KEY`를 사용합니다.
- 기본 외부 API URL은 `https://www.nl.go.kr/seoji/SearchApi.do`이며, 필요 시 `NATIONAL_LIBRARY_ISBN_API_URL`로 override할 수 있습니다.

## Admin auth

관리 기능은 `public.admin_users`에 등록된 관리자만 접근할 수 있습니다. 화면에서는 이메일 대신 관리자 아이디로 로그인하며, 비밀번호는 `password_hash` 컬럼의 bcrypt hash와 비교합니다.

1. 관리자용 UUID와 bcrypt hash를 준비합니다.
2. SQL Editor 또는 psql에서 다음 쿼리로 첫 관리자를 등록합니다.

```sql
insert into auth.users (id, email)
values ('<admin-user-id>', 'sanuplib-admin@sanuplib.local')
on conflict (id) do nothing;

insert into public.admin_users (user_id, login_id, password_hash, role)
values ('<admin-user-id>', 'SanupLib', '<bcrypt-password-hash>', 'admin')
on conflict (user_id) do update
set login_id = excluded.login_id,
    password_hash = excluded.password_hash,
    role = excluded.role;
```

관리자 로그인/세션 endpoint:

```http
POST /api/auth/admin/login
POST /api/auth/admin/logout
GET /api/auth/admin/session
```

- 로그인 성공 시 httpOnly signed session cookie를 저장합니다.
- 서버 보호 API에서는 `requireAdminSession(request)` helper로 세션과 관리자 권한을 확인합니다.
