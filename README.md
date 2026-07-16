# Sanuphs-Library

학교 도서 대여 관리용 Next.js 앱입니다.

## Local PostgreSQL

1. PostgreSQL에 앱용 사용자와 데이터베이스를 만듭니다.

```sql
CREATE USER library_user WITH PASSWORD 'strong-password';
CREATE DATABASE library_db OWNER library_user;
GRANT ALL PRIVILEGES ON DATABASE library_db TO library_user;
```

2. `.env.example`을 참고해 `.env.local` 또는 `.env`를 설정합니다.

```env
DATABASE_URL=postgres://library_user:strong-password@localhost:5432/library_db
ADMIN_LOGIN_ID=SanupLib
ADMIN_SESSION_SECRET=<32+ chars random secret>
ADMIN_COOKIE_SECURE=false
```

`http://서버IP:포트`로 직접 접속할 때는 `ADMIN_COOKIE_SECURE=false`를 사용합니다. HTTPS가
적용된 도메인으로 접속할 때만 `true`로 설정하세요. HTTP에서 `true`이면 로그인 응답이
성공해도 브라우저가 세션 쿠키를 저장하지 않아 로그인 화면으로 되돌아갑니다.

관리자 비밀번호는 환경변수가 아니라 `public.admin_users.password_hash`에 bcrypt hash로 저장합니다. DB migration은 기본 로그인 `SanupLib` / `SanupLib2026!`에 해당하는 첫 관리자 계정을 만들거나 누락된 hash를 채우므로, 운영 환경에서는 적용 직후 강한 비밀번호의 bcrypt hash로 교체하세요.

기존 DB에서 로그인이 실패하면 다음 보정 SQL을 먼저 실행합니다. 이 SQL은 구형 DB에
`login_id`/`password_hash` 컬럼을 추가하고 기본 관리자 계정을 복구합니다.

```bash
psql "$DATABASE_URL" -f ./database/reset-default-admin-password.sql
```

실행 후 기본 로그인은 `SanupLib` / `SanupLib2026!`입니다. 운영 환경에서는 로그인 확인
직후 강한 비밀번호의 bcrypt hash로 변경하세요.

3. `supabase/migrations`의 migration을 적용합니다. 독립 PostgreSQL은 먼저 Supabase 호환 스키마와 역할을 한 번 초기화해야 합니다. 아래의 관리자 URL은 migration 실행에만 사용하고 앱의 `DATABASE_URL`로 저장하지 마세요.

Windows PowerShell:

```powershell
$env:DATABASE_ADMIN_URL="postgres://postgres:admin-password@localhost:5432/library_db"
psql $env:DATABASE_ADMIN_URL -v ON_ERROR_STOP=1 -f .\database\local-postgres-init.sql
npx.cmd supabase db push --db-url $env:DATABASE_ADMIN_URL
```

Linux/macOS/server Bash:

```bash
export DATABASE_ADMIN_URL="postgres://postgres:admin-password@localhost:5432/library_db"
psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -f ./database/local-postgres-init.sql
npx supabase db push --db-url "$DATABASE_ADMIN_URL"
```

Supabase 프로젝트는 호환 초기화 SQL을 생략하고 `npx supabase db push --db-url "$DATABASE_ADMIN_URL"`만 실행합니다. 이후 스키마 변경도 새 migration 파일을 추가해 같은 명령으로 적용합니다.

이전 롤업 SQL로 만든 기존 DB는 바로 `db push`하지 마세요. 실제 반영된 버전을 확인한 뒤 `supabase migration repair <version> --status applied --db-url "$DATABASE_ADMIN_URL"`로 이미 적용된 migration만 이력에 등록해야 합니다.

4. Next.js 서버를 실행합니다.

```bash
npm install
npm run build
npm run start
```

배포 서버에서 소스를 갱신한 경우 `npm run start`만 실행하면 새 의존성 설치와 새 빌드가
반영되지 않습니다. 반드시 `npm ci`와 `npm run build`가 성공한 뒤 기존 프로세스를 종료하고
`npm run start`로 다시 시작하세요.

개발 중에는 `npm run dev`를 사용하면 됩니다.
