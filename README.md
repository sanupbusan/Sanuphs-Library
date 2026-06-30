# Sanuphs-Library

학교 도서 대여 관리용 Next.js 앱입니다.

## Local PostgreSQL

1. PostgreSQL에 `library` 데이터베이스를 만듭니다.

```powershell
createdb library
```

2. `.env.example`을 참고해 `.env.local` 또는 `.env`를 설정합니다.

```powershell
DATABASE_URL=postgres://postgres:postgres@localhost:5432/library
ADMIN_LOGIN_ID=SanupLib
ADMIN_PASSWORD=<strong-password>
ADMIN_SESSION_SECRET=<32+ chars random secret>
```

3. 로컬 PostgreSQL 호환 init SQL과 기존 migration을 적용합니다.

```powershell
.\scripts\migrate-local-postgres.ps1
```

`pg_cron`이 설치된 PostgreSQL에서 연간 대출 초기화 스케줄까지 적용하려면:

```powershell
.\scripts\migrate-local-postgres.ps1 -EnablePgCron
```

4. Next.js 서버를 실행합니다.

```powershell
npm install
npm run dev
```

운영 로컬 서버에서는 `npm run build` 후 `npm run start`를 사용하세요.
