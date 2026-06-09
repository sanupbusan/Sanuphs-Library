# Supabase database

This project now defines the library database through Supabase CLI migrations.

## Local setup

Docker Desktop must be installed and running before starting the local Supabase stack.

```bash
npx supabase@2.105.0 start
npx supabase@2.105.0 db reset
```

The reset command applies `supabase/migrations/20260609000000_create_library_schema.sql` and loads `supabase/seed.sql`.

## Cloud setup

```bash
npx supabase@2.105.0 link --project-ref <project-ref>
npx supabase@2.105.0 db push
```

Set these public client values in your deployment environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not commit service-role keys or local environment files.
