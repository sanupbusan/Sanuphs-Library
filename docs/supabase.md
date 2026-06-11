# Supabase setup

이 프로젝트는 Supabase CLI 마이그레이션으로 도서관 DB 스키마를 관리하고, Next.js 앱은 public anon key로 Supabase Cloud에 연결합니다.

## Environment variables

`.env.example`을 기준으로 로컬 또는 배포 환경에 값을 등록합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
ADMIN_LOGIN_ID=SanupLib
ADMIN_AUTH_EMAIL=sanuplib-admin@sanuplib.local
```

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Dashboard > Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Dashboard > Project Settings > API > anon public key
- `ADMIN_LOGIN_ID`: 로그인 화면에서 입력할 관리자 아이디입니다. 기본값은 `SanupLib`입니다.
- `ADMIN_AUTH_EMAIL`: Supabase Auth에 실제로 생성할 관리자 사용자 이메일입니다. 앱은 관리자 아이디를 이 이메일 로그인으로 매핑합니다.
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

## Deployment

Vercel, Netlify, GitHub Actions 같은 배포 환경에는 다음 값을 secret/environment variable로 등록합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_LOGIN_ID`
- `ADMIN_AUTH_EMAIL`

도서 검색과 로그인 API는 Next.js API route를 사용하므로 정적 파일 호스팅만으로는 동작하지 않습니다. Vercel 또는 Next 서버를 지원하는 런타임에 배포해야 합니다.

현재 DB 정책은 도서 검색은 anon 접근을 허용하고, 도서/학생/대여/희망도서 관리 데이터 변경은 `admin_users`에 등록된 관리자만 허용합니다. 공개 화면에서 관리 대시보드 데이터를 노출하려면 RLS 정책과 view 권한을 먼저 의도적으로 조정해야 합니다.

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
