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
```

관리자 비밀번호는 환경변수가 아니라 `public.admin_users.password_hash`에 bcrypt hash로 저장합니다. 로컬 bootstrap SQL은 기본 로그인 `SanupLib` / `SanupLib2026!`에 해당하는 첫 관리자 계정을 만들거나 누락된 hash를 채우므로, 운영 환경에서는 적용 직후 강한 비밀번호의 bcrypt hash로 교체하세요.

기존 DB에서 기본 비밀번호가 맞지 않으면 다음 SQL로 기본 관리자 비밀번호를 다시 맞출 수 있습니다.

```bash
psql "$DATABASE_URL" -f ./database/reset-default-admin-password.sql
```

3. 로컬 PostgreSQL 롤업 SQL을 적용합니다.

Windows PowerShell:

```powershell
$env:DATABASE_URL="postgres://library_user:strong-password@localhost:5432/library_db"
psql $env:DATABASE_URL -f .\database\local-postgres-copy-paste.sql
```

Linux/macOS/server Bash:

```bash
export DATABASE_URL="postgres://library_user:strong-password@localhost:5432/library_db"
psql "$DATABASE_URL" -f ./database/local-postgres-copy-paste.sql
```

원격 DB 서버에 적용할 때는 `localhost` 대신 DB 서버 IP 또는 도메인을 넣습니다.

```bash
psql "postgres://library_user:strong-password@db.example.com:5432/library_db" \
  -f ./database/local-postgres-copy-paste.sql
```

`database/local-postgres-copy-paste.sql`은 로컬/신규 DB bootstrap용 단일 롤업 스크립트입니다.

4. Next.js 서버를 실행합니다.

```bash
npm install
npm run build
npm run start
```

개발 중에는 `npm run dev`를 사용하면 됩니다.
