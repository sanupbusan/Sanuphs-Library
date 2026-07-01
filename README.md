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
ADMIN_PASSWORD=<admin-login-password>
ADMIN_SESSION_SECRET=<32+ chars random secret>
```

3. 로컬 PostgreSQL 호환 init SQL과 기존 migration을 적용합니다.

Windows PowerShell:

```powershell
$env:DATABASE_URL="postgres://library_user:strong-password@localhost:5432/library_db"
.\scripts\migrate-local-postgres.ps1
```

Linux/macOS/server Bash:

```bash
export DATABASE_URL="postgres://library_user:strong-password@localhost:5432/library_db"
chmod +x ./scripts/migrate-local-postgres.sh
./scripts/migrate-local-postgres.sh
```

원격 DB 서버에 적용할 때는 `localhost` 대신 DB 서버 IP 또는 도메인을 넣습니다.

```bash
./scripts/migrate-local-postgres.sh \
  --database-url "postgres://library_user:strong-password@db.example.com:5432/library_db"
```

`pg_cron`이 설치된 PostgreSQL에서 연간 대출 초기화 스케줄까지 적용하려면:

```bash
./scripts/migrate-local-postgres.sh --enable-pg-cron
```

4. Next.js 서버를 실행합니다.

```bash
npm install
npm run build
npm run start
```

개발 중에는 `npm run dev`를 사용하면 됩니다.
