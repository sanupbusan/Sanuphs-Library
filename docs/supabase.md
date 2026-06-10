# Supabase setup

이 프로젝트는 Supabase CLI 마이그레이션으로 도서관 DB 스키마를 관리하고, Next.js 앱은 public anon key로 Supabase Cloud에 연결합니다.

## Environment variables

`.env.example`을 기준으로 로컬 또는 배포 환경에 값을 등록합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
```

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Dashboard > Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Dashboard > Project Settings > API > anon public key
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

현재 DB 정책은 도서 검색은 anon 접근을 허용하고, 학생/대여 관리 데이터는 authenticated 사용자에게만 허용합니다. 공개 화면에서 관리 대시보드 데이터를 노출하려면 RLS 정책과 view 권한을 먼저 의도적으로 조정해야 합니다.
