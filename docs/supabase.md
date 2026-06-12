# Supabase setup

이 프로젝트는 Supabase CLI 마이그레이션으로 도서관 DB 스키마를 관리하고, Next.js 앱은 public anon key로 Supabase Cloud에 연결합니다.

## Environment variables

`.env.example`을 기준으로 로컬 또는 배포 환경에 값을 등록합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
ADMIN_LOGIN_ID=SanupLib
ADMIN_AUTH_EMAIL=sanuplib-admin@sanuplib.local
NATIONAL_LIBRARY_ISBN_API_KEY=<national-library-isbn-api-key>
```

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Dashboard > Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Dashboard > Project Settings > API > anon public key
- `ADMIN_LOGIN_ID`: 로그인 화면에서 입력할 관리자 아이디입니다. 기본값은 `SanupLib`입니다.
- `ADMIN_AUTH_EMAIL`: Supabase Auth에 실제로 생성할 관리자 사용자 이메일입니다. 앱은 관리자 아이디를 이 이메일 로그인으로 매핑합니다.
- `NATIONAL_LIBRARY_ISBN_API_KEY`: 새 책 추가 화면에서 ISBN으로 책 정보를 조회할 때 사용하는 국립중앙도서관 ISBN API 키입니다. 서버 전용이므로 `NEXT_PUBLIC_`을 붙이지 않습니다.
- `.env`, `.env.local`, `.env.production` 같은 실제 값 파일은 커밋하지 않습니다.
- `service_role` key는 브라우저/Next public 환경변수에 넣지 않습니다.

## Local app connection

로컬에서 클라우드 Supabase를 바라보려면 `.env.example`을 참고해 `.env.local`을 만들고 public 값을 채운 뒤 개발 서버를 재시작합니다.

```bash
npm run dev
```

## Local Supabase stack

로컬 Supabase 컨테이너를 직접 띄울 때만 Docker Desktop이 필요합니다.

```bash
npx supabase@2.105.0 start
npx supabase@2.105.0 db reset
```

`db reset`은 `supabase/migrations/20260609000000_create_library_schema.sql`을 적용합니다. 현재 `supabase/seed.sql`은 샘플 데이터를 만들지 않는 no-op 파일입니다.

## Cloud setup

Supabase Cloud 프로젝트를 만든 뒤 CLI를 연결하고 마이그레이션을 push합니다.

```bash
npx supabase@2.105.0 login
npx supabase@2.105.0 link --project-ref <project-ref>
npx supabase@2.105.0 db push
```

초기 데이터는 Supabase SQL Editor, CSV import, 또는 운영용 import 스크립트로 별도 등록합니다. 마이그레이션과 seed 파일은 샘플 데이터를 생성하지 않습니다.

## Annual loan reset

`supabase/migrations/20260612100000_schedule_annual_loan_reset.sql`은 매년 1월 1일 00:00(KST)에 대여 기록을 초기화합니다.

- Supabase의 `pg_cron`을 사용합니다.
- Supabase cron은 UTC 기준으로 실행되므로 `0 15 31 12 *`에 예약합니다. 이는 한국시간 1월 1일 00:00입니다.
- 실행 함수는 `public.reset_annual_loan_records()`입니다.
- 초기화 시 `public.loans`의 모든 대여 기록을 삭제하고, 모든 도서의 `available_copies`를 `total_copies`로 맞춥니다.

## Deployment

Vercel, Netlify, GitHub Actions 같은 배포 환경에는 다음 값을 secret/environment variable로 등록합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_LOGIN_ID`
- `ADMIN_AUTH_EMAIL`
- `NATIONAL_LIBRARY_ISBN_API_KEY`

도서 검색과 로그인 API는 Next.js API route를 사용하므로 정적 파일 호스팅만으로는 동작하지 않습니다. Vercel 또는 Next 서버를 지원하는 런타임에 배포해야 합니다.

현재 DB 정책은 도서 검색은 anon 접근을 허용하고, 도서/학생/대여/희망도서 관리 데이터 변경은 `admin_users`에 등록된 관리자만 허용합니다. 공개 화면에서 관리 대시보드 데이터를 노출하려면 RLS 정책과 view 권한을 먼저 의도적으로 조정해야 합니다.

## Book search API

도서 검색 backend endpoint는 다음과 같습니다.

```http
GET /api/books/search?q=<검색어>&limit=20
```

- `q` 또는 `query`: 제목 또는 저자 검색어입니다. 빈 값이면 등록된 도서를 제한 개수만큼 조회합니다.
- `limit`: 선택값이며 기본 20, 최대 50입니다.
- Supabase의 `search_books` RPC를 호출합니다.

## Admin book registration

새 책 등록은 로그인된 관리자만 사용할 수 있습니다.

```http
POST /api/admin/books
```

요청 body:

```json
{
  "title": "책 이름",
  "author": "저자",
  "publisher": "출판사",
  "isbn": "ISBN 코드",
  "schoolBookCode": "학교 내 도서 코드"
}
```

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

관리 기능은 Supabase Auth 사용자 중 `public.admin_users`에 등록된 사용자만 접근할 수 있습니다. 화면에서는 이메일 대신 관리자 아이디로 로그인합니다.

1. Supabase Dashboard > Authentication > Users에서 관리자 계정을 1개 생성합니다.
   - Email: `sanuplib-admin@sanuplib.local` 또는 `ADMIN_AUTH_EMAIL` 값
   - Password: `SanupLib2026!`
   - App login ID: `SanupLib`
2. 생성된 사용자의 `id`를 복사합니다.
3. SQL Editor에서 다음 쿼리로 첫 관리자를 등록합니다.

```sql
insert into public.admin_users (user_id, login_id, role)
values ('<auth-user-id>', 'SanupLib', 'admin');
```

관리자 로그인/세션 endpoint:

```http
POST /api/auth/admin/login
POST /api/auth/admin/logout
GET /api/auth/admin/session
```

- 로그인 성공 시 httpOnly 쿠키에 관리자 access token을 저장합니다.
- 서버 보호 API에서는 `requireAdminSession(request)` helper로 세션과 관리자 권한을 확인합니다.
- `아이디 또는 비밀번호가 올바르지 않습니다.`가 뜨면 Supabase Auth의 email/password/confirm 상태를 먼저 확인합니다.
